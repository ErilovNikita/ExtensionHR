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
        debugLogs('Попытка открыть окно с авторизацией career.habr.com', 'debug')
        let redirectURL = encodeURIComponent('https://career.habr.com/companies/vitaexpress')
        chrome.tabs.create({
            url: `https://career.habr.com/integrations/oauth/authorize?client_id=${habrClientID}&redirect_uri=${redirectURL}&response_type=code`, 
            selected: true
        })
    }
  
}

// Метод для генирации нового токена habr
// function genHabrToken(port = null) {

//     Settings = updateSettings()

//     fetch('https://habr.ru/oauth/token', { 
//         method: "POST",
//         body: `grant_type=authorization_code&client_id=${Settings.Client_id_habr}&client_secret=${Settings.Client_secret_habr}&code=${Settings.habr_authorization_code}`,
//         headers: {
//             "Content-Type":"application/x-www-form-urlencoded",
//         },
//     })
//     .then((response) => response.json())
//     .then((data) => {
//         if (data.error == "invalid_grant" || data.error == "invalid_client") {
//             debugLogs(`При выполнении genHabrToken(${Settings.habr_authorization_code}) произошла ошибка ${data.error}`, 'error')
//             chrome.storage.local.remove(["habr_authorization_code"])
//             setTimeout(habrTOKEN, 500, updateSettings(), port)
//         } else {
//             if (data.access_token) {

//                 // На основе входящих данных получаем дату смерти токена 
//                 var deadLineToken = new Date()
//                 deadLineToken.setSeconds( deadLineToken.getSeconds() + data.expires_in )
                
//                 // Записываем все данные в память
//                 chrome.storage.local.set({
//                     "habr_token": data.access_token,
//                     "habr_token_deadline": deadLineToken.getTime(),
//                     "habr_refresh_token": data.refresh_token
//                 });
            
//                 //updateTokenHabrOnSD(updateSettings())
//                 return data.access_token
//             } else {
//                 debugLogs('При выполнении genHabrToken() произошла неизвестная ошибка!' + data.error, 'error')
//             }
//         }
//     })

// }

// Метод возвращает свежий токен Habr
function habrTOKEN(Settings, port = null) {
    debugLogs('Проверка токена Habr', 'debug')
    if (Settings.habr_token && Settings.habr_token != '' & Settings.habr_token !== undefined) {
        if ( new Date() < new Date(Settings.habr_token_deadline) ) {
            debugLogs('Найден активированный токен Habr', 'debug')
            return Settings.habr_token
        } else {
            debugLogs('Найден токен Habr с истекшим сроком давности, жду 1000мс и повоторяю попытку', 'debug')
            chrome.storage.local.remove([
                "habr_token",
                "habr_authorization_code",
                "habr_token_deadline",
                "habr_refresh_token"
            ])
            setTimeout(habrTOKEN, 1000, updateSettings(), port)
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