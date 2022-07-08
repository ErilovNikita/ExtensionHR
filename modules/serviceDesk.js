// Метод для получения секретов HH из Сервис Деска
function getHHsecrets(Settings) {
    let url = `https://${Settings.serverURL}/sd/services/rest/execM2H?func=modules.ChromeIntegration.getHHsecrets&params=`
    
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
                "Client_secret_hh": dataJSON.Client_secret_hh,
                "Client_id_hh": dataJSON.Client_id_hh
            });
            updateSettings()
        }
    })
}

// Метод для получения ФИО из Сервис Деска
function getNameEmpl(Settings) {
    if ( Settings.serverLogin ) {
        let arrArg = Settings.serverLogin.replace('@', '.').split('.')
        fetch(`https://${Settings.serverURL}/sd/services/rest/execM2H?func=modules.ChromeIntegration.UUID&params='${arrArg[0]}','${arrArg[1]}','${arrArg[2]}','${arrArg[3]}','name'`, { 
            method: "GET" 
        })
        .then((response) => response.text())
        .then((data) => {
            if ( data != '' && data.indexOf('<!DOCTYPE html>') == -1 ) {
                chrome.storage.local.set({"sdName": data});
                updateSettings()
            }
        })
    }
}

// Метод для обновления статуса в Сервис Деск
function updateStateOnSD(SettingsData) {
    if (SettingsData && SettingsData.ServiceDeskTOKEN && SettingsData.ServiceDeskTOKEN != '') {

        let login = SettingsData.serverLogin
        loginEncoded = login.replaceAll('.', SettingsData.dotScript).replaceAll('@', Settings.mailDog)
        let url = `https://${SettingsData.serverURL}/sd/services/rest/execM2H?func=modules.ChromeIntegration.updateExtensionState&params='${loginEncoded}','${manifest.version.replaceAll('.', SettingsData.dotScript)}'`

        fetch(url, { 
            method: "GET" 
        })
        .then((response) => response.text())
        .then((data) => {
            if (data.indexOf('<!DOCTYPE html>') != -1 || data.indexOf('<Error in script') != -1 ) {
                debugLogs('Ошибка авторизации при автообновлении статуса в Сервис Деск', 'warn')
            } else {
                debugLogs("Авто обновление статуса в Сервис Деск: " + data, 'warn')
            }
        })

    } else {
        debugLogs("Авто обновление статуса в Сервис Деск: Не возможно, токен не найден", 'warn')
    }
}

// Метод для обновления токена HH пользователя в Сервис Деск
function updateTokenHHOnSD(Settings) {

    if (Settings.ServiceDeskTOKEN && Settings.ServiceDeskTOKEN != '' && Settings.hh_token && Settings.hh_token != '') {

        let loginEncoded =  Settings.serverLogin.replaceAll('.', 'doplkioklb').replaceAll('@', Settings.mailDog)
        let url = `https://${Settings.serverURL}/sd/services/rest/execM2H?func=modules.ChromeIntegration.updateTokenHH&params='${loginEncoded}','${Settings.hh_token}'`

        fetch(url, { 
            method: "GET" 
        })
        .then((response) => response.text())
        .then((data) => {
            if (data.indexOf('<!DOCTYPE html>') != -1 || data.indexOf('<Error in script') != -1 ) {
                debugLogs('Ошибка авторизации при автообновлении токена HH.ru в Сервис Деск', 'warn')
            } else {
                debugLogs("Авто обновление токена HH.ru в Сервис Деск: " + data, 'warn')
            }
        })

    }
}

// Метод возвращает свежий токен Сервис Деск
function verifServiceDeskTOKEN(SettingsData, port = null, broken = false) {
    debugLogs(`Проверка токена Service Desk: ${SettingsData.ServiceDeskTOKEN}`, 'debug', port)
    if ( (
        !SettingsData.ServiceDeskTOKEN || 
        SettingsData.ServiceDeskTOKEN == '' || 
        SettingsData.ServiceDeskTOKEN === undefined
        ) ||
        broken
     ) {
        debugLogs('Токен Service Desk не обнаружен, запрашиваю новый', 'debug', port)
        if (SettingsData.serverLogin != '' && SettingsData.serverLogin !== undefined) {

            let l = SettingsData.serverLogin
            let arrArg = l.replace('@', '.').split('.')
            let url = `https://${SettingsData.serverURL}/sd/services/rest/execM2H?func=modules.ChromeIntegration.UUID&params='${arrArg[0]}','${arrArg[1]}','${arrArg[2]}','${arrArg[3]}'`

            fetch(url, { 
                method: "GET" 
            })
            .then((response) => response.text())
            .then((data) => {
                if (
                    data.indexOf('<!DOCTYPE html>') != -1 || 
                    data.indexOf('<Error in script') != -1 
                ) {
                    chrome.tabs.create({url: 'https://' + SettingsData.serverURL + '/sd/', selected: true})
                    if (SettingsData.ServiceDeskTOKEN) {
                        return verifServiceDeskTOKEN(updateSettings(), port)
                    }
                } else {
                    if ( data.indexOf('error') != -1) {
                        return null
                    }
                    chrome.storage.local.set({"ServiceDeskTOKEN": data});
                    debugLogs('Токен Service Desk успешно получен', 'debug', port)
                    updateSettings()
                    return data
                }
            })
    
        } else {
            port.postMessage({'alert': 'Внимание! Расшерение не настроенно! Введите Логин от ServiceDesk для продолжения использования! Перейдите в настройки или обратитесь в службу поддержки'})
            // alert('Внимание! Расшерение не настроенно! Введите Логин от ServiceDesk для продолжения использования! Перейдите в настройки или обратитесь в службу поддержки')
            chrome.tabs.create({url: `chrome-extension://${chrome.runtime.id}/settings.html`, selected: true})
            
            function checkLogin() {
                debugLogs('Жду логин пользователя в настроках расширения 1500мс...', 'warn')
                if (SettingsData.serverLogin != '' && SettingsData.serverLogin !== undefined) {
                    debugLogs('Пользователь ввел логин, запускаю verifServiceDeskTOKEN()', 'debug')
                    return verifServiceDeskTOKEN(updateSettings(), port)
                } else {
                    setTimeout(checkLogin, 1500)
                }
            }
            checkLogin()
        }
    } else {
        if (SettingsData.ServiceDeskTOKEN.indexOf('<!DOCTYPE html>') == -1 ) {
            debugLogs('Токен Service Desk уже существует, проверка на сервере', 'debug', port)

            let url = `https://${SettingsData.serverURL}/sd/services/rest/execM2H?func=modules.ChromeIntegration.verification&params='${SettingsData.ServiceDeskTOKEN}'`
            fetch(url, { 
                method: "GET" 
            })
            .then((response) => response.text())
            .then((data) => {
                if (data == 'true') {
                    debugLogs('Существующий токен Service Desk - валидный', 'debug', port)
                    return SettingsData.ServiceDeskTOKEN
                } else {
                    debugLogs('Существующий токен Service Desk - НЕ валидный, запуск повторной генерации', 'warn', port)
                    chrome.storage.local.remove(["ServiceDeskTOKEN"]);
                    
                    return verifServiceDeskTOKEN(updateSettings(), port, true)
                }
            })

        } else {
            debugLogs('Существующий токен Service Desk - НЕ валидный, запуск повторной генерации...', 'warn', port)
            chrome.storage.local.remove(["ServiceDeskTOKEN"]);

            return verifServiceDeskTOKEN(updateSettings(), port, true)
        }
    }
}

// Метод для фиксации отправки резюме в Сервис Деск
function resumeSended(Settings, auth = false) {

    if (Settings.ServiceDeskTOKEN && Settings.ServiceDeskTOKEN != '') {

        let loginEncoded = Settings.login.replaceAll('.', Settings.dotScript).replaceAll('@', Settings.mailDog)
        let url = `https://${Settings.serverURL}/sd/services/rest/execM2H?func=modules.ChromeIntegration.resumeSendedExtension&params='${loginEncoded}`

        fetch(url, { 
            method: "GET"
        })
        .then((response) => response.text())
        .then((data) => {
            if (
                data.indexOf('<!DOCTYPE html>') != -1 || 
                data.indexOf('<Error in script') != -1 
            ) {
                debugLogs('resumeSended(): Ошибка авторизации в Service Desk', 'error')
                if (auth) {
                    chrome.tabs.create({url: `https://${Settings.serverURL}/sd/`, selected: true})
                    if (Settings.ServiceDeskTOKEN) {
                        verifServiceDeskTOKEN(updateSettings())
                    }
                }
            }
        })
    }
}

// Метод для отправки резюме в Сервис Деск
function sendResume(Settings, resumeObject, port = null) {
    debugLogs('Резюме сформировано для отправки в Service Desk', 'debug', port)
    debugLogs(resumeObject, 'JSON');
  
    debugLogs('Выгружаю данные в ServiceDesk', 'debug', port)

    if (Settings.ServiceDeskTOKEN &&
        Settings.ServiceDeskTOKEN !== undefined &&
        Settings.ServiceDeskTOKEN.indexOf('<!DOCTYPE html>') == -1
    ) {
        debugLogs('Отправка резюме в Serivce Desk', 'debug', port)
        
        let url = `https://${Settings.serverURL}/sd/services/rest/exec-post?accessKey=${Settings.ServiceDeskTOKEN}&func=modules.ChromeIntegration.takeResume&params=requestContent`
        //let url = 'https://ptsv2.com/t/o5il2-1655903466/post'

        fetch(url, { 
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify(resumeObject)
        })
        .then((response) => response.text())
        .then((data) => {
            stopTimer = true
            let resumeLink = null

            if (data.indexOf('resume') != -1) {
                switch (JSON.parse(data).type) {
                    case 'update':
                        debugLogs('Данный кандидат уже есть в базе Service Desk, его данные успешно обновлены', 'debug', port)
                        resumeLink = JSON.parse(data).UUID
                    break;
    
                    case 'create':
                        debugLogs(`Кандидат ${resumeObject.title} успешно создан: ${JSON.parse(data).UUID}`, 'debug', port)
                        resumeLink = JSON.parse(data).UUID
                        try {
                            resumeSended(updateSettings())
                        } catch (e) {
                            debugLogs(`Ошибка при выполнении resumeSended() - ${e}`, 'error', port)
                        }
                    break;
    
                    case 'error':
                        debugLogs(JSON.parse(data).description, 'error', port)
                    break;
                }
            } else {
                if (data.indexOf('Переход не может быть выполнен: Время жизни ключа авторизации') != -1) {
                    verifServiceDeskTOKEN(updateSettings(), port)
                } else {
                    debugLogs('Кандидат не создан. Повторите попытку чуть позже. Ошибка SD: ' + data, 'error', port)
                }
            }
            updateStateOnSD(Settings)
            if ( resumeLink ) {
                chrome.tabs.create({url: `https://${Settings.serverURL}/sd/operator/#uuid:${resumeLink}`, selected: true})
            }
        })  
    } else {
        if (Settings.ServiceDeskTOKEN === undefined || !Settings.ServiceDeskTOKEN) {
            debugLogs('Ключа не обнаружено, выполняю обновление', 'debug', port)
            verifServiceDeskTOKEN(updateSettings(), port)
        }
        port.postMessage({'alert': 'Возникли проблемы при авторизации с Service Desk. Войдите в свой аккаунт, затем можете закрыть вкладку'})
    }
}