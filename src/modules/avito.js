// Метод генирации нового токена Avito
async function genAvitoToken(ClientID, ClientSecret) {

    if (ClientID == '' || ClientSecret == '') {
        debugLogs('genAvitoToken(): Внимание произшла ошибка!', 'error')
    } else {

        return fetch(`https://api.avito.ru/token/`, { 
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            method: "POST",
            body : `grant_type=client_credentials&client_id=${ClientID}&client_secret=${ClientSecret}`
        })
        .then((response) => response.json())
        .then((data) => {

            if (!data.error) {
                // На основе входящих данных получаем дату смерти токена 
                var deadLineToken = new Date()
                deadLineToken.setSeconds(
                    deadLineToken.getSeconds() + data.expires_in
                )
                
                // Сохраняем все в память
                chrome.storage.local.set({
                    "avito_token"           :   data.access_token,
                    "avito_token_deadline"  :   deadLineToken.getTime()
                });
                debugLogs(`Новый токен Avito - Получен (${data.access_token})`, 'log')
                updateSettings()

                return data.access_token
            } else {
                debugLogs(`Ошибка при получении токен Avito: ${data.error}`, 'error')
            }
        })
    }
  
}

// Метод для верификации токена Avito
function avitoTOKEN(port = null) {
    debugLogs('Проверка токена Avito', 'debug', port)

    Settings = updateSettings()

    if ( Settings.avito_token && new Date() < new Date(Settings.avito_token_deadline) ) {

        debugLogs('Найден активированный токен Avito', 'debug', port)
        return Settings.avito_token

    } else {
        debugLogs('Токен Avito не найден, проверка ключей для создания', 'debug', port)

        if (Settings.Client_id_avito === undefined ||
            Settings.Client_secret_avito === undefined ||
            Settings.Client_id_avito == '' ||
            Settings.Client_secret_avito == ''
        ) {
            debugLogs('Ключи Avito для генерации токена не найдены, запуск обновления ключей', 'debug', port)

            // Кидаю алерт в пользователя
            port.postMessage({'alert': 'Внимание!\nСейчас будет выполнено автоматическое обновление API ключей, это займет меньше минуты'})

            fetch('https://www.avito.ru/web/1/profile/openapi/clients', { 
                method: "GET"
            })
            .then((response) => response.json())
            .then((data) => {

                debugLogs('Получаю новый токен Avito', 'debug')

                try {
                    clientId = data[0].clientId
                    clientSecret = data[0].clientSecret

                    // Сохраняем все в память
                    chrome.storage.local.set({
                        "Client_id_avito"           :   clientId,
                        "Client_secret_avito"  :   clientSecret
                    });

                    updateSettings()
    
                    return genAvitoToken(clientId, clientSecret)
                } catch (error) {
                    debugLogs('Avito API: ' + data.error.message, 'error', port)
                    return null
                }
            })
            
        } else {
            debugLogs('Получаю новый токен Avito', 'debug')
            return genAvitoToken(Settings.Client_id_avito, Settings.Client_secret_avito);
        }
    }

}

// Метод для получения резюме
async function getResumeOnAvitoPage(resumeID) {
    debugLogs('Получение резюме Avito...', 'debug')

    Settings = updateSettings()

    return fetch(`https://api.avito.ru/job/v2/resumes/${resumeID}?photos=true`, { 
        headers: {
            'Content-Type'  : 'application/x-www-form-urlencoded',
            'Authorization' : `Bearer ${Settings.avito_token}`
        },
        method: "GET"
    })
    .then((response) => response.json())
    .then((data) => {
        debugLogs('Резюме получено: ', 'debug')
        debugLogs(data, 'JSON')
        return data
    })

}

// Метод для получения контактных данных из резюме
async function getContactsOnAvitoPage(resumeID, port = null) {
    debugLogs('Токен на месте, резюмеID получен, выполнение запроса...', 'debug')

    Settings = updateSettings()

    return fetch(`https://api.avito.ru/job/v1/resumes/${resumeID}/contacts/`, { 
        headers: {
            'Content-Type'  : 'application/x-www-form-urlencoded',
            'Authorization' : `Bearer ${Settings.avito_token}`
        },
        method: "GET"
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.error && data.error.message.indexOf('not available') != -1) {
            if (port) { port.postMessage({ "alert" : 'Контактные данные получить не удалось, проблема на стороне Avito'}) }
            debugLogs('Контактные данные НЕ получены, ошибка Avito: ' + JSON.parse(getContact.response).error.message, 'debug')
        } else {
            debugLogs('Контактные данные получены: ', 'debug')
            debugLogs(data, 'JSON')
            return data
        }
    })

}

// Метод для формирования полей резюме
async function createResumeAvito(id, port = null) {

    Settings = updateSettings()

    let generalData = await getResumeOnAvitoPage(id)
    let contactData = await getContactsOnAvitoPage(id, port)

    // Создаётся объект promise для формирования всех полей
    let processingCreatedAvitoResume = new Promise((successResume) => {
        debugLogs('Формирую тело...', 'debug')

        let body = generalData
        body.type = "avito"
        body.authorLogin = Settings.serverLogin
        body.private = contactData

        successResume(body);
    })

    // Отправляю резюме
    processingCreatedAvitoResume.then( resumeBody => {
        sendResumeAPI(resumeBody, port)
    });    
}