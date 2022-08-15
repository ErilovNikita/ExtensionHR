// Метод для получения секретов SJ из Сервис Деска
function getSJsecrets(Settings) {
    let url = `https://${Settings.serverURL}/sd/services/rest/execM2H?func=modules.ChromeIntegration.getSJsecrets&params=`
    
    fetch(url, { 
        method: "GET" 
    })
    .then((response) => response.text())
    .then((data) => {
        if (
            data != '' && 
            data.indexOf('<!DOCTYPE html>') == -1
        ) {
            dataJSON = JSON.parse(data)
            chrome.storage.local.set({
                "api_secret_key": dataJSON.api_secret_key
            });
            updateSettings()
        }
    })
}