// Метод для получения Auth кода HH
function getAuthCodeHH(Settings, notValid = false) {
    let hhClientID = Settings.Client_id_hh

    if (
        !notValid &&
        Settings.hh_authorization_code && 
        Settings.hh_authorization_code != '' && 
        Settings.hh_authorization_code !== undefined
    ) {
        return Settings.hh_authorization_code
    } else {
        debugLogs('Попытка открыть окно с авторизацией HH.ru', 'debug')
        chrome.tabs.create({url: `https://hh.ru/oauth/authorize?response_type=code&client_id=${hhClientID}`, selected: true})
    }
  
}
// Метод для генирации нового токена HH
function genHHToken(port = null) {

    Settings = updateSettings()

    fetch('https://hh.ru/oauth/token', { 
        method: "POST",
        body: `grant_type=authorization_code&client_id=${Settings.Client_id_hh}&client_secret=${Settings.Client_secret_hh}&code=${Settings.hh_authorization_code}`,
        headers: {
            "Content-Type":"application/x-www-form-urlencoded",
        },
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.error == "invalid_grant" || data.error == "invalid_client") {
            debugLogs(`При выполнении genHHToken(${Settings.hh_authorization_code}) произошла ошибка ${data.error}`, 'error')
            chrome.storage.local.remove(["hh_authorization_code"])
            setTimeout(hhTOKEN, 500, updateSettings(), port)
        } else {
            if (data.access_token) {

                // На основе входящих данных получаем дату смерти токена 
                var deadLineToken = new Date()
                deadLineToken.setSeconds( deadLineToken.getSeconds() + data.expires_in )
                
                // Записываем все данные в память
                chrome.storage.local.set({
                    "hh_token": data.access_token,
                    "hh_token_deadline": deadLineToken.getTime(),
                    "hh_refresh_token": data.refresh_token
                });
            
                updateTokenHHOnSD()
                return data.access_token
            } else {
                debugLogs('При выполнении genHHToken() произошла неизвестная ошибка!' + data.error, 'error')
            }
        }
    })

}

// Метод возвращает свежий токен HH
function hhTOKEN(Settings, port = null) {
    debugLogs('Проверка токена HH', 'debug')
    if (Settings.hh_token && Settings.hh_token != '' & Settings.hh_token !== undefined) {
        if ( new Date() < new Date(Settings.hh_token_deadline) ) {
            debugLogs('Найден активированный токен HH', 'debug')
            return Settings.hh_token
        } else {
            debugLogs('Найден токен HH с истекшим сроком давности, жду 1000мс и повоторяю попытку', 'debug')
            chrome.storage.local.remove([
                "hh_token",
                "hh_authorization_code",
                "hh_token_deadline",
                "hh_refresh_token"
            ])
            setTimeout(hhTOKEN, 1000, updateSettings(), port)
        }
    } else {
        debugLogs('Токен HH не найден, проверка ключей для создания', 'debug')
    
        // Запускаем метод генирации Authorization code
        getAuthCodeHH(updateSettings(), true)

        function awaitAuthCode(updSettings) {
            if (
                updSettings.hh_authorization_code  && 
                updSettings.hh_authorization_code  != '' && 
                updSettings.hh_authorization_code  !== undefined
            ) {
                genHHToken(port)
            } else {
                debugLogs('Жду authorization code 1500мс...', 'debug')
                setTimeout(awaitAuthCode, 1500, updateSettings())
            }
        }
        
        awaitAuthCode(updateSettings())

    }
}

// Метод для получения резюме
async function getResumeOnHHpage(Settings, resumeID, port = null) {
    // Обьявляем переменную для хранения резюме
    let resume = null

    if (Settings.hh_token && Settings.hh_token != '' && Settings.hh_token !== undefined) {
        let hh_token = Settings.hh_token
        debugLogs('Токен hh.ru - На месте', 'debug', port)

        let response = await fetch(`https://api.hh.ru/resumes/${resumeID}`, { 
            method: "GET",
            headers: {
                "Authorization"     : `Bearer ${hh_token}`,
                "HH-User-Agent"     : `integration Service Desk/2.0 (erilov.na@vitaexpress.ru)`
            }
        })

        if ( response.status == 403 ) {
            //resp = JSON.parse(data.response)
            resp = await response.json()
        
            // Обработка ошибки token_revoked
            if (resp.errors[0].type == 'oauth' && resp.errors[0].value == 'token_revoked') {
                debugLogs('Обнаружена ошибка ключа HH, попытка исправить', 'debug', port) 
                chrome.storage.local.remove([
                    "hh_authorization_code",
                    "hh_token",
                    "hh_token_deadline"
                ])
                updateSettings()
                chrome.tabs.create({url: `https://hh.ru/oauth/authorize?response_type=code&client_id=${hhClientID}`, selected: true})
            } else if (resp.errors[0].type == 'api_access_payment') { 
                debugLogs(`<b>При обращении к HH, возникла ошибка!</b></br><em>Отсутствует оплаченный доступ</em><br>Обратитесь к сташему менеджеру для решения проблемы`, 'error', port)
            } else {
                debugLogs(`<b>При обращении к HH, возникла неизвестная ошибка! <br><em>${resp.errors[0].type}: </b>${resp.errors[0].value}</em><br>Обратитесь в Сервис Деск, для решения`, 'error', port)
            }
        } else {
            resume = await response.json();
            debugLogs(resume, 'JSON')

            // Формируем резюме
            createResumeHH(Settings, resume, port)
        }
  
    } else {
        debugLogs('Токен HH не найден, ожидание hhTOKEN() 1500мс...', 'warn')
        setTimeout(getResumeOnHHpage, 1500, updateSettings(), resumeID, port)
    }
}

// Метод для формирования полей резюме
function createResumeHH(Settings, resume, port = null) {
    if (resume && resume != '' && resume !== undefined) {
        if (Settings.serverLogin && Settings.serverLogin != '' && Settings.serverLogin !== undefined) {

            debugLogs('Формирую поля резюме', 'debug', port)
            resume.type = "hh"
            resume.authorLogin = Settings.serverLogin
            sendResumeAPI(resume, port)

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