// Метод для получения Auth кода habr
function getAuthCodeHabr(Settings, notValid = false) {
    let habrClientID = Settings.Client_id_habr

    if (
        !notValid &&
        Settings.habr_authorization_code && 
        Settings.habr_authorization_code != '' && 
        Settings.habr_authorization_code !== undefined
    ) {
        return Settings.habr_authorization_code
    } else {
        debugLogs('Попытка открыть окно с авторизацией Хабр Карьера', 'debug')
        let redirectURL = encodeURIComponent('https://career.habr.com/companies/vitaexpress')
        chrome.tabs.create({
            url: `https://career.habr.com/integrations/oauth/authorize?client_id=${habrClientID}&redirect_uri=${redirectURL}&response_type=code`, 
            selected: true
        })
    }
  
}

// Метод для генирации нового токена habr
function genHabrToken(port = null) {

    Settings = updateSettings()
    let redirectURL = encodeURIComponent('https://career.habr.com/companies/vitaexpress')

    fetch('https://career.habr.com/integrations/oauth/token', { 
        method: "POST",
        body: `grant_type=authorization_code&client_id=${Settings.Client_id_habr}&client_secret=${Settings.Client_secret_habr}&code=${Settings.habr_authorization_code}&redirect_uri=${redirectURL}`,
        headers: {
            "Content-Type":"application/x-www-form-urlencoded",
        },
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.error == "invalid_grant" || data.error == "invalid_client") {
            debugLogs(`При выполнении genHabrToken(${Settings.habr_authorization_code}) произошла ошибка ${data.error}`, 'error')
            chrome.storage.local.remove(["habr_authorization_code"])
            setTimeout(habrTOKEN, 2000, updateSettings(), port)
        } else {
            if (data.access_token) {

                // На основе входящих данных получаем дату смерти токена (10 минут жизни)
                let createdDateTime = new Date(parseInt(data.created_at) * 1000 )
                let deadLineToken = new Date(createdDateTime.getTime() + 10 * 60000)

                console.log(deadLineToken.getTime().toString())

                // Записываем все данные в память
                chrome.storage.local.set({
                    "habr_token": data.access_token,
                    "habr_token_deadline": deadLineToken.getTime()
                });

                updateSettings()
            
                //updateTokenHabrOnSD(updateSettings())
                return data.access_token
            } else {
                debugLogs('При выполнении genHabrToken() произошла неизвестная ошибка!' + data.error, 'error')
            }
        }
    })

}

// Метод возвращает свежий токен Habr
function habrTOKEN(Settings, port = null) {
    debugLogs('Проверка токена Habr', 'debug')
    if (Settings.habr_token && Settings.habr_token != '' & Settings.habr_token !== undefined) {
        if ( new Date() < new Date(Settings.habr_token_deadline) ) {
            debugLogs('Найден активированный токен Habr', 'debug')
            return Settings.habr_token
        } else {
            debugLogs('Найден токен Habr с истекшим сроком давности, жду 1500мс и повоторяю попытку', 'debug')
            chrome.storage.local.remove([
                "habr_token",
                "habr_authorization_code",
                "habr_token_deadline"
            ])
            setTimeout(habrTOKEN, 1500, updateSettings(), port)
        }
    } else {
        debugLogs('Токен Habr не найден, проверка ключей для создания', 'debug')
    
        // Запускаем метод генирации Authorization code
        getAuthCodeHabr(updateSettings(), true)

        function awaitAuthCode(updSettings) {
            if (
                updSettings.habr_authorization_code  && 
                updSettings.habr_authorization_code  != '' && 
                updSettings.habr_authorization_code  !== undefined
            ) {
                genHabrToken(port)
            } else {
                debugLogs(`Жду код авторизации от Habr'а 1500мс...`, 'debug')
                setTimeout(awaitAuthCode, 1500, updateSettings())
            }
        }
        
        awaitAuthCode(updateSettings())

    }
}

// Метод для получения резюме
async function getResumeOnHabrPage(Settings, resumeID, port = null) {
    // Обьявляем переменную для хранения резюме
    let resume = null

    if (Settings.habr_token && Settings.habr_token != '' && Settings.habr_token !== undefined) {
        let habr_token = Settings.habr_token
        let habrClientID = Settings.Client_id_habr

        debugLogs('Токен Хабр Карьера - На месте', 'debug', port)

        let response = await fetch(`https://career.habr.com/api/v1/integrations/users/${resumeID}`, { 
            method: "GET",
            headers: {
                "Authorization"     : `Bearer ${habr_token}`
            }
        })

        if ( response.status == 403 ) {
            resp = JSON.parse(data.response)
        
            // Обработка ошибки token_revoked
            if (resp.errors[0].type == 'oauth' && resp.errors[0].value == 'token_revoked') {
                debugLogs('Обнаружена ошибка ключа Хабр Карьера, попытка исправить', 'debug', port) 
                chrome.storage.local.remove([
                    "habr_authorization_code",
                    "habr_token",
                    "habr_token_deadline"
                ])
                updateSettings()
                
                debugLogs('Попытка открыть окно с авторизацией Хабр Карьера', 'debug')
                let redirectURL = encodeURIComponent('https://career.habr.com/companies/vitaexpress')
                chrome.tabs.create({
                    url: `https://career.habr.com/integrations/oauth/authorize?client_id=${habrClientID}&redirect_uri=${redirectURL}&response_type=code`, 
                    selected: true
                })
        
            }  else {
                debugLogs(`<b>При обращении к Хабр Карьера, возникла неизвестная ошибка! <br><em>${resp.errors[0].type}: </b>${resp.errors[0].value}</em><br>Обратитесь в Сервис Деск, для решения`, 'error', port)
            }
        } else {
            resume = await response.json();
            debugLogs(resume, 'JSON')
        }
        
        // Формируем резюме
        createResumeHabr(Settings, resume, port)
  
    } else {
        debugLogs('Токен Хабр Карьера не найден, ожидание habrTOKEN() 1500мс...', 'warn')
        setTimeout(getResumeOnHabrPage, 1500, updateSettings(), resumeID, port)
    }
}

// Метод для формирования полей резюме
function createResumeHabr(Settings, resume, port = null) {
    if (resume && resume != '' && resume !== undefined) {
        if (Settings.serverLogin && Settings.serverLogin != '' && Settings.serverLogin !== undefined) {

            debugLogs('Формирую поля резюме', 'debug', port)

            resume.type = "habr"
            resume.authorLogin = Settings.serverLogin
            sendResumeAPI(Settings, resume, port)

        } else {
            port.postMessage({'alert': 'Внимание! Расширение не настроенно! Введите Логин от ServiceDesk для продолжения использования!'})
            chrome.tabs.create({url: 'chrome-extension://' + chrome.app.getDetails().id + '/settings.html', selected: true})
            
            function checkLogin() {
                debugLogs('Жду логин пользователя в настроках расширения 1500мс...', 'warn')
                if (Settings.serverLogin != '' && Settings.serverLogin !== undefined) {
                    debugLogs('Пользователь ввел логин, запускаю createResume()', 'debug')
                    createResume()
                } else {
                    setTimeout(checkLogin, 1500)
                }
            }

            checkLogin()
        }
    } else {
        debugLogs('Ожидание данных 100мс...', 'warn')
        setTimeout(createResume, 100)
    }
}