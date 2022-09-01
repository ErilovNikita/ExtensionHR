// Метод возвращает свежий токен SJ
function sjTOKEN(Settings, port = null) {
    debugLogs('Проверка токена SuperJob', 'debug')
    if (Settings.sj_token && Settings.sj_token != '' & Settings.sj_token !== undefined) {
        if ( new Date() < new Date(Settings.sj_token_deadline) ) {
            debugLogs('Найден активированный токен SuperJob', 'debug')
            return Settings.sj_token
        } else {
            debugLogs('Найден токен SuperJob с истекшим сроком давности, жду 1000мс и повоторяю попытку', 'debug')
            chrome.storage.local.remove([
                "sj_token",
                "sj_token_deadline",
            ])
            setTimeout(sjTOKEN, 1000, updateSettings(), port)
        }
    } else {
        debugLogs('Токен SuperJob не найден, проверка ключей для создания', 'debug')

        // Запускаем метод генирации Authorization code
        getAuthCodeSJ(updateSettings(), true)

        function awaitAuthCode(updSettings) {
            if (
                updSettings.sj_authorization_code  && 
                updSettings.sj_authorization_code  != '' && 
                updSettings.sj_authorization_code  !== undefined
            ) {
                genSJToken(port)
            } else {
                debugLogs('Жду authorization code 1500мс...', 'debug')
                setTimeout(awaitAuthCode, 1500, updateSettings())
            }
        }
        
        awaitAuthCode(updateSettings())
    }
}

// Метод для генирации нового токена SJ
function genSJToken(port = null) {

    Settings = updateSettings()
    let redirectURL = 'https://zima.superjob.ru/clients/apteki-vita-2210879.html'

    fetch('https://api.superjob.ru/2.0/oauth2/access_token/', { 
        method: "POST",
        body: `code=${Settings.sj_authorization_code}&client_id=${Settings.Client_id_sj}&client_secret=${Settings.Client_secret_sj}&redirect_uri=${redirectURL}`,
        headers: {
            "Content-Type":"application/x-www-form-urlencoded",
        },
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.error == "invalid_grant" || data.error == "invalid_client") {
            debugLogs(`При выполнении genSJToken(${Settings.sj_authorization_code}) произошла ошибка ${data.error.message}`, 'error')
            chrome.storage.local.remove(["sj_authorization_code"])
            setTimeout(shTOKEN, 500, updateSettings(), port)
        } else {
            if (data.access_token) {

                // На основе входящих данных получаем дату смерти токена 
                var deadLineToken = new Date()
                deadLineToken.setSeconds( deadLineToken.getSeconds() + data.expires_in )
                
                // Записываем все данные в память
                chrome.storage.local.set({
                    "sj_token": data.access_token,
                    "sj_token_deadline": deadLineToken.getTime(),
                    "sj_refresh_token": data.refresh_token
                });
                updateSettings()
                //updateTokenSJOnSD(updateSettings())
                return data.access_token
            } else {
                debugLogs(`При выполнении genSJToken() произошла неизвестная ошибка! ${data.error.message}`, 'error')
            }
        }
    })

}

// Метод для получения Auth кода SJ
function getAuthCodeSJ(Settings, notValid = false) {
    let sjClientID = Settings.Client_id_sj

    if (
        !notValid &&
        Settings.sj_authorization_code && 
        Settings.sj_authorization_code != '' && 
        Settings.sj_authorization_code !== undefined
    ) {
        return Settings.sj_authorization_code
    } else {
        debugLogs('Попытка открыть окно с авторизацией SuperJob.ru', 'debug')
        let redirectURL = encodeURIComponent('https://zima.superjob.ru/clients/apteki-vita-2210879.html')
        chrome.tabs.create({url: `https://www.superjob.ru/authorize?client_id=${sjClientID}&redirect_uri=${redirectURL}`, selected: true})
    }
  
}

// Метод для получения резюме
async function getResumeOnSJpage(Settings, resumeID, port = null) {
    // Обьявляем переменную для хранения резюме
    let resume = null

    if (Settings.sj_token && Settings.sj_token != '' && Settings.sj_token !== undefined) {
        let sj_token = Settings.sj_token
        debugLogs('Токен SuperJob.ru - На месте', 'debug', port)

        let response = await fetch(`https://api.superjob.ru/2.0/resumes/${resumeID}`, { 
            method: "GET",
            headers: {
                "Authorization"     : `Bearer ${sj_token}`,
                "X-Api-App-Id"      : Settings.Client_secret_sj
            }
        })

        if ( response.status == 403 ) {
            resp = JSON.parse(data.response)
        
            // Обработка ошибки token_revoked
            if (resp.errors[0].type == 'oauth' && resp.errors[0].value == 'token_revoked') {
                debugLogs('Обнаружена ошибка ключа SuperJob, попытка исправить', 'debug', port) 
                chrome.storage.local.remove([
                    "sj_authorization_code",
                    "sj_token",
                    "sj_token_deadline"
                ])
                updateSettings()
                let redirectURL = encodeURIComponent('https://zima.superjob.ru/clients/apteki-vita-2210879.html')
                chrome.tabs.create({url: `https://www.superjob.ru/authorize?client_id=${sjClientID}&redirect_uri=${redirectURL}`, selected: true})
            }  else {
                debugLogs(`<b>При обращении к SuperJob, возникла неизвестная ошибка! <br><em>${resp.errors[0].type}: </b>${resp.errors[0].value}</em><br>Обратитесь в Сервис Деск, для решения`, 'error', port)
            }
        } else {
            resume = await response.json();
            debugLogs(resume, 'JSON')
        }
        
        // Формируем резюме
        createResumeSJ(Settings, resume, port)
  
    } else {
        debugLogs('Токен HH не найден, ожидание hhTOKEN() 1500мс...', 'warn')
        setTimeout(getResumeOnHHpage, 1500, updateSettings(), resumeID, port)
    }
}