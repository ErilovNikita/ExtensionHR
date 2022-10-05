// Метод для получения секретов из Сервис Деска
function getSecrets(app_name) {

    let updSettings = updateSettings()

    let url = `https://${updSettings.serverURL}/sd/services/rest/exec-post?func=modules.extensionHR.getSecrets&params=requestContent`
    
    fetch(url, { 
        method: "POST",
        body: {
            "app" : app_name, 
            "format" : "json"
        }
    })
    .then((response) => response.text())
    .then((data) => {
        if (data.client_id) {

            let writeData = {}
            writeData[`Client_secret_${app_name}`] = dataJSON.Client_secret
            writeData[`Client_id_${app_name}`] = dataJSON.Client_id

            chrome.storage.local.set(writeData);
            updateSettings()
        }
    })
}

// Метод для получения ФИО из Сервис Деска
function getNameEmpl() {
    let SettingsData = updateSettings()
    if ( SettingsData.serverLogin ) {
        let url = `https://${SettingsData.serverURL}/sd/services/rest/exec-post?func=modules.extensionHR.getNameEmpl&params=requestContent`
        let bodies = {
            "login" : SettingsData.serverLogin,
            "name" : true
        } 
        fetch(url, { 
            method: "POST",
            body: JSON.stringify(bodies)
        })
        .then((response) => response.text())
        .then((data) => {
            console.log(bodies);
            if ( data != '' && data.indexOf('<!DOCTYPE html>') == -1 ) {
                chrome.storage.local.set({"sdName": data});
                updateSettings()
            }
        })
    }
}

// Метод для обновления статуса в Сервис Деск
function updateStateOnSD() {

    let SettingsData = updateSettings()
    if (SettingsData && SettingsData.ServiceDeskTOKEN && SettingsData.ServiceDeskTOKEN != '') {

        let url = `https://${SettingsData.serverURL}/sd/services/rest/exec-post?func=modules.extensionHR.updateExtensionState&params=requestContent`

        let bodies = {
            'login' : SettingsData.serverLogin.toString(),
            'version' : manifest.version.toString()
        }

        if (SettingsData.hh_token && SettingsData.hh_token != null && SettingsData.hh_token != '') {
            bodies['token'] = SettingsData.hh_token
        }

        fetch(url, { 
            method: "POST",
            body: JSON.stringify(bodies)
        })
        .then((response) => response.text())
        .then((data) => {
            if (data.indexOf('Статус успешно обновлен!') == 0) {
                debugLogs("Авто обновление статуса в Сервис Деск: " + data, 'warn')
            } else {
                debugLogs('Ошибка авторизации при автообновлении статуса в Сервис Деск', 'warn')
            }
        })

    } else {
        debugLogs("Авто обновление статуса в Сервис Деск: Не возможно, токен не найден", 'warn')
    }
}

// Метод для обновления токена HH пользователя в Сервис Деск
function updateTokenHHOnSD() {

    let SettingsData = updateSettings()

    if (SettingsData.ServiceDeskTOKEN && SettingsData.ServiceDeskTOKEN != '' && SettingsData.hh_token && SettingsData.hh_token != '') {
        let url = `https://${SettingsData.serverURL}/sd/services/rest/exec-post?func=modules.extensionHR.updateTokenHH&params=requestContent`
        let bodies = {
            "login": SettingsData.serverLogin,
            "token": SettingsData.hh_token
        }

        fetch(url, { 
            method: "POST",
            body: JSON.stringify(bodies) 
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
function verifServiceDeskTOKEN(port = null, broken = false) {

    let SettingsData = updateSettings()
    debugLogs(`Проверка токена Service Desk`, 'debug', port)
    if ( (
            !SettingsData.ServiceDeskTOKEN || 
            SettingsData.ServiceDeskTOKEN == '' || 
            SettingsData.ServiceDeskTOKEN === undefined
        ) || broken
     ) {
        debugLogs('Токен Service Desk не обнаружен, запрашиваю новый', 'debug', port)
        if (SettingsData.serverLogin != '' && SettingsData.serverLogin !== undefined) {

            let url = `https://${SettingsData.serverURL}/sd/services/rest/exec-post?func=modules.extensionHR.getNameEmpl&params=requestContent`
            let bodies = {
                "login" : SettingsData.serverLogin
            } 

            fetch(url, { 
                method: "POST",
                body: JSON.stringify(bodies) 
            })
            .then((response) => response.text())
            .then((data) => {
                console.log(data);
                if (
                    data.indexOf('<!DOCTYPE html>') != -1 || 
                    data.indexOf('<Error in script') != -1 
                ) {
                    debugLogs('Получение токена заверишлось ошибкой, сеесия окончена, открываю окно авторизации', 'debug')
                    chrome.tabs.create({url: 'https://' + SettingsData.serverURL + '/sd/', selected: true})
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
            if (port) {
                port.postMessage({'alert': 'Внимание! Расшерение не настроенно! Введите Логин от ServiceDesk для продолжения использования! Перейдите в настройки или обратитесь в службу поддержки'})
            }
            chrome.tabs.create({url: `chrome-extension://${chrome.runtime.id}/settings.html`, selected: true})
            
            function checkLogin() {
                debugLogs('Жду логин пользователя в настроках расширения 1500мс...', 'warn')
                if (SettingsData.serverLogin != '' && SettingsData.serverLogin !== undefined) {
                    debugLogs('Пользователь ввел логин, запускаю verifServiceDeskTOKEN()', 'debug')
                    return verifServiceDeskTOKEN(port)
                } else {
                    setTimeout(checkLogin, 1500)
                }
            }
            checkLogin()
        }
    } else {
        if (SettingsData.ServiceDeskTOKEN.indexOf('<!DOCTYPE html>') == -1 ) {
            debugLogs(`Токен Service Desk уже существует, проверка на сервере (${SettingsData.ServiceDeskTOKEN})`, 'debug', port)
            let url = `https://${SettingsData.serverURL}/sd/services/rest/exec-post?func=modules.extensionHR.verification&params=requestContent`

            fetch(url, { 
                method: "POST",
                body: JSON.stringify({"keyUUID" : SettingsData.ServiceDeskTOKEN})
            })
            .then((response) => response.text())
            .then((data) => {
                if (data == 'true') {
                    debugLogs('Существующий токен Service Desk - валидный', 'debug', port)
                    return SettingsData.ServiceDeskTOKEN
                } else {
                    debugLogs('Существующий токен Service Desk - НЕ валидный, запуск повторной генерации', 'warn', port)
                    chrome.storage.local.remove(["ServiceDeskTOKEN"]);
                    
                    setTimeout(verifServiceDeskTOKEN, 1500, port, true)
                }
            })

        } else {
            debugLogs('Существующий токен Service Desk - НЕ валидный, запуск повторной генерации...', 'warn', port)
            chrome.storage.local.remove(["ServiceDeskTOKEN"]);

            return setTimeout(verifServiceDeskTOKEN, 1500, port, true)
        }
    }
}

// Метод для фиксации отправки резюме в Сервис Деск
function resumeSended(auth = false) {

    let SettingsData = updateSettings()
    if (SettingsData.ServiceDeskTOKEN && SettingsData.ServiceDeskTOKEN != '') {

        let url = `https://${SettingsData.serverURL}/sd/services/rest/exec-post?func=modules.extensionHR.resumeSendedExtension&params=requestContent`
        fetch(url, { 
            method: "POST",
            body: JSON.stringify({"login" : SettingsData.serverLogin})
        })
        .then((response) => response.text())
        .then((data) => {
            console.log(data)
            if (
                data.indexOf('<!DOCTYPE html>') != -1 || 
                data.indexOf('<Error in script') != -1 
            ) {
                debugLogs('resumeSended(): Ошибка авторизации в Service Desk', 'error')
                if (auth) {
                    chrome.tabs.create({url: `https://${SettingsData.serverURL}/sd/`, selected: true})
                    if (SettingsData.ServiceDeskTOKEN) {
                        verifServiceDeskTOKEN()
                    }
                }
            }
        })
    }
}

// Метод для отправки резюме в Сервис Деск основанный на базе hrAPI
function sendResumeAPI(resumeObject, port = null) {

    let SettingsData = updateSettings()
    debugLogs('Резюме сформировано для отправки в Service Desk', 'debug', port)
    debugLogs(resumeObject, 'JSON');
  
    debugLogs('Выгружаю данные в ServiceDesk', 'debug', port)

    if (SettingsData.ServiceDeskTOKEN &&
        SettingsData.ServiceDeskTOKEN !== undefined &&
        SettiSettingsDatangs.ServiceDeskTOKEN.indexOf('<!DOCTYPE html>') == -1
    ) {
        debugLogs('Отправка резюме в Serivce Desk', 'debug', port)
        
        let url = `https://${SettingsData.serverURL}/sd/services/rest/exec-post?accessKey=${SettingsData.ServiceDeskTOKEN}&func=modules.hrAPI.initResume&params=requestContent`

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
                    case 'updated':
                        debugLogs('Данный кандидат уже есть в базе Service Desk, его данные успешно обновлены', 'debug')
                        resumeLink = JSON.parse(data).UUID
                    break;
    
                    case 'created':
                        debugLogs(`Кандидат ${resumeObject.title} успешно создан: ${JSON.parse(data).UUID}`, 'debug')
                        resumeLink = JSON.parse(data).UUID
                        try {
                            resumeSended()
                        } catch (e) {
                            debugLogs(`Ошибка при выполнении resumeSended() - ${e}`, 'error')
                        }
                    break;
    
                    case 'error':
                        debugLogs(JSON.parse(data).description, 'error', port)
                    break;
                }
            } else {
                if (data.indexOf('Переход не может быть выполнен: Время жизни ключа авторизации') != -1) {
                    return verifServiceDeskTOKEN(port)
                } else {
                    debugLogs('Кандидат не создан. Повторите попытку чуть позже. Ошибка SD: ' + data, 'error', port)
                }
            }
            updateStateOnSD()
            if ( resumeLink ) {
                chrome.tabs.create({url: `https://${SettingsData.serverURL}/sd/operator/#uuid:${resumeLink}`, selected: true})
            }
        })  
    } else {
        if (SettingsData.ServiceDeskTOKEN === undefined || !SettingsData.ServiceDeskTOKEN) {
            debugLogs('Ключа не обнаружено, выполняю обновление', 'debug', port)
            return verifServiceDeskTOKEN(port)
        }
        port.postMessage({'alert': 'Возникли проблемы при авторизации с Service Desk. Войдите в свой аккаунт, затем можете закрыть вкладку'})
    }
}

// Метод для проверки резюме по собственной базе
function findApplicantByID(id, callback) {

    let SettingsData = updateSettings()
    debugLogs('Запрашиваю данные о соискателе в собственной базе...', 'debug')

    fetch(`https://${SettingsData.serverURL}/sd/services/rest/exec-post?func=modules.extensionHR.findApplicantByID&params=requestContent`, { 
        method: "POST",
        body: JSON.stringify({"id" : id})
    })
    .then((response) => response.text())
    .then((data) => {
        debugLogs(data, 'JSON');
        callback(data)
    })

}