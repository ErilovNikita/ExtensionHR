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
                debugLogs('Жду authorization code 1500мс...', 'debug')
                setTimeout(awaitAuthCode, 1500, updateSettings())
            }
        }
        
        awaitAuthCode(updateSettings())

    }
}