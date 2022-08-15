//genHhKey() -> generationHHKey(hhAuthCode, hhClientID)

/* 
    --------- Параметры ---------
*/

const debugON = true
const checkNameOnResume = false
const manifest = chrome.runtime.getManifest();
let stopTimer = false
let Settings = {}

// Заполним дефолтные настройки
chrome.storage.local.set({
    "serverURL": 'help.aptekivita.ru',
    "dotScript": 'doplkioklb',
    "mailDog": 'cjgfrf'
});

//Возможные ссылки для резюме
const arrSite = [
    "hh.ru/resume/",
    [
        "avito.ru/",
        "/rezume/"
    ],
    [
        "/sd/operator/#uuid:",
        "candidate",
        "resume"
    ],
    "superjob.ru/resume"
]

/* 
    --------- Инициализация модулей ---------
*/

// Модуль функций для Сервис Деска
importScripts('./modules/serviceDesk.js');

// Модуль функций для HH.ru
importScripts('./modules/hh.js');

// Модуль функций для Avito.ru
importScripts('./modules/avito.js');


/* 
    --------- Методы ---------
*/

// Метод запуска
function __init() {
    // Обновим настройки
    let updSettings = updateSettings()

    setTimeout(function() {
        updateStateOnSD(updSettings)
        getHHsecrets(updSettings)
        updateTokenHHOnSD(updSettings)
    }, 2000 );
    
    // Циклический запуск через 1 минуту
    setTimeout(__init, 600000 );
} 

// Обновление переменной настроек из памяти
function updateSettings() {
    getAllStorageData().then(items => {
        Object.assign(Settings, items);
    });
    return Settings
}

// Метод для получения всех данных из Chrome.Strorage.Local
function getAllStorageData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(items);
        });
    });
}

// Метод для логирования
function debugLogs(text, mode, port = null) {
    if (typeof(debugON) === "boolean") {
  
        let str = '%c(' + new Date().toString().substr(0, 24) + ') %c[' + mode + '] %c' + text
    
        switch (mode) {
            case 'error':
                console.log(str, 'color: green', 'color: red', 'color: white');
            break;

            case 'warn':
                console.log(str, 'color: green', 'color: yellow', 'color: white');
            break;

            case 'log':
                console.log(str, 'color: green', 'color: white', 'color: white');
            break;

            case 'JSON':
                console.log(text);
            break;
    
            default:
                console.log(str, 'color: green', 'color: white', 'color: white');
            break;
        }
        
        if (port) {
            port.postMessage({ "log" : text})
        }

    }
}

// Метод получения Base64 из ссылки на фото 
const toDataURL = url => fetch(url).then(response => response.blob())
    .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
}))

// Таймер выполнения операции
function timeOperation() {
    if (typeof(debugON) === "boolean") {
        var step = 50;
        var endsAfter = 0
        let maxTime = 20000
    
        var interval = setInterval(function() {
            endsAfter += step
            if (stopTimer) {
                clearInterval(interval)
                debugLogs('Операция заняла: ' + endsAfter + 'мс', 'log')
                stopTimer = false
            }
            if (endsAfter >= maxTime) {
                clearInterval(interval)
                debugLogs('Операция выполяется больше ' + maxTime + 'мс. Выполняю остановку процесса', 'error')
            }
        }, step);
    }
}

// Метод для созданя Badge расширения
function setBadge(tabID, text, color) {
    chrome.action.setBadgeBackgroundColor({ color: color }, () => {
        chrome.action.setBadgeText({ tabId: tabID, text: text});
    });
}

// Метод для обработки станицы для добавления Badge
function renderBadge(activeTab) {
    setTimeout(function() {
        let tabId = activeTab.id
        chrome.tabs.get(tabId).then(function(tab) {
            if ( tab.url.indexOf(arrSite[0]) != -1) {  // HH Resume
                setBadge(tab.id, 'HH', '#F00')
            } else if ( tab.url.indexOf(arrSite[1][0]) != -1 && tab.url.indexOf(arrSite[1][1]) != -1 ){ // Avito Resume
                setBadge(tab.id, 'Avito', '#01aaff')
            } else if ( tab.url.indexOf(arrSite[2][0]) != -1 && ( tab.url.indexOf(arrSite[2][1]) != -1 || tab.url.indexOf(arrSite[2][2]) != -1) ){ // Avito Resume
                setBadge(tab.id, 'SD', '#01aaff')
            } else {
                setBadge(tab.id, '', '#F00')
            }
        });
    }, 1000 );
}

// Процесс для запуска обработки резюме HH
function processingHH(Settings, resumeURL, port = null) {

    // Находим уникальный ID резюме
    let resumeID = resumeURL.substr(resumeURL.indexOf('/resume/') + 8, resumeURL.length)
    if (resumeID.indexOf('?') != -1) {
        resumeID = resumeID.substr(0, resumeID.indexOf('?'))
    }

    // Запускаем верификацию токена Сервис Деск
    verifServiceDeskTOKEN(Settings, port)

    // Начинаю отсчет времени
    timeOperation() 

    port.postMessage({ "log" : "Запуск импорта резюме c HH.ru"});
        
    if (Settings.Client_id_hh && Settings.Client_secret_hh && Settings.ServiceDeskTOKEN) {
        // Запускаем верификацию токена HH
        hhTOKEN(Settings, port)
        setTimeout(getResumeOnHHpage, 1000, Settings, resumeID, port)
    }
}

// Процесс для запуска обработки резюме Super Job
function processingSJ(Settings, resumeURL, port = null) {

    // Находим уникальный ID резюме
    let resumeID = resumeURL.substr(resumeURL.indexOf('/resume/') + 8)
    if (resumeID.indexOf('html') != -1) {
        resumeID = resumeID.substr(0, resumeID.indexOf('.html'))
    }

    // Запускаем верификацию токена Сервис Деск
    verifServiceDeskTOKEN(Settings, port)

    // Начинаю отсчет времени
    timeOperation() 

    port.postMessage({ "log" : "Запуск импорта резюме c SuperJob.ru"});
        
    if (Settings.Client_id_hh && Settings.Client_secret_hh && Settings.ServiceDeskTOKEN) {
        // Запускаем верификацию токена SJ
        //hhTOKEN(Settings, port)
        //setTimeout(getResumeOnHHpage, 1000, Settings, resumeID, port)
    }
}

// Процесс для запуска обработки резюме Avito
function processingAvito(Settings, resumeURL, port) {

    // Находим уникальный ID резюме
    let resumeID = resumeURL.substr(resumeURL.lastIndexOf('_') + 1, resumeURL.length);
    // Запускаем верификацию токена Сервис Деск
    verifServiceDeskTOKEN(Settings, port)
    // Начинаю отсчет времени
    timeOperation() 

    port.postMessage({ "log" : "Запуск импорта резюме c Авито"});
    
    // Запускаю верификацию токена Авито
    avitoTOKEN(port)
    // Запускаем основоной код
    createResumeAvito(resumeID)
}

// Процесс для запуска обработки резюме SD
function processingSD(Settings, resumeURL, port) {

    // Есть открытая карточка кандидата или резюме, определим тип карточки
    let type = resumeURL.substr(resumeURL.indexOf('#uuid:') + 6, resumeURL.length)
    type = type.substr(0, type.indexOf('$'))

    // Определим UUID обьекта
    let sUUID = resumeURL.substr(resumeURL.indexOf('$') + 1, resumeURL.length)

    // Уберем мусор если он есть
    if (sUUID.indexOf('!') != -1 ) { sUUID = sUUID.substr(0, sUUID.indexOf('!')) }
    if (sUUID.indexOf('%') != -1 ) { sUUID = sUUID.substr(0, sUUID.indexOf('%')) }

    let url = `https://${Settings.serverURL}/sd/services/rest/exec-post?accessKey=${Settings.ServiceDeskTOKEN}&func=modules.ChromeIntegration.getlinkfromURL&params='${type}','${sUUID}'`
    fetch(url, {
        method: "POST"
    })
    .then((response) => response.text())
    .then((data) => {

        var patt = /<a[^>]*href=["']([^"']*)["']/g
        while(match=patt.exec(data)){
            resumeURL = match[1]
        }

        if (data.indexOf('hh.ru') != -1) {
            processingHH(Settings, resumeURL, port)
        } else if (data.indexOf('avito.ru') != -1) {
            processingAvito(Settings, resumeURL, port)
        } else {
            port.postMessage({ "mode" : "close"});
            port.postMessage({ "log" : 'К сожалению, обновление данного резюме - не возможно'})
        }

    })
}


/* 
    --------- Основной код ---------
*/

// Запускаем фоновые задачи
__init()

// Слушатель сообщений с фронта 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.Client_id_avito || message.Client_secret_avito) {
        chrome.storage.local.set({
            "Client_id_avito": message.Client_id_avito,
            "Client_secret_avito": message.Client_secret_avito
        });
        updateSettings()
        // genAvitoToken(localStorage.Client_id_avito, localStorage.Client_secret_avito)
        console.log('genAvitoToken')
    } else {
        if (message.hh_authorization_code ) {
            chrome.storage.local.set({"hh_authorization_code": message.hh_authorization_code});
            debugLogs(`Получен новый hh_authorization_code: ${message.hh_authorization_code}`)
            //updSettings = updateSettings()
            //setTimeout(hhTOKEN, 1000, updSettings)
        } else {
            if (message.updateResume) {
                console.log('Обновление')
            } else {
                console.error(message)
            }
        }
    }
});

// Слушатель для вызова расширения
// Вызывается, когда пользователь нажимает на действие браузера.
chrome.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(function(msg) {
        switch (msg) {
            case 'run_proc':
                // Отправить сообщение на активную вкладку
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {

                    // Обновляем переменную с настройками
                    Settings = updateSettings()       
        
                    // По ссылке определю что выполнять
                    if ( tabs[0].url.indexOf(arrSite[0]) != -1) {  // HH Resume
                        
                        // Запускаем процесс обработки резюме
                        processingHH(Settings, tabs[0].url, port)
            
                    } else if ( tabs[0].url.indexOf(arrSite[1][0]) != -1 && tabs[0].url.indexOf(arrSite[1][1]) != -1 ) {  // Avito Resume

                        // Запускаем процесс обработки резюме
                        processingAvito(Settings, tabs[0].url, port)                        
            
                    } else if (tabs[0].url.indexOf(arrSite[2][0]) != -1 ) { // Обновление резюме из карточки резюме Service Desk
                        if (tabs[0].url.indexOf(arrSite[2][1]) != -1 || tabs[0].url.indexOf(arrSite[2][2]) != -1) {
                            
                            // Запускаем процесс обработки резюме
                            processingSD(Settings, tabs[0].url, port)

                        } else {
                            // port.postMessage({ "mode" : "close"});
                            port.postMessage({ "log" : 'К сожалению, действий на данной странице не обнаружено'})
                        }
                    }  else if (tabs[0].url.indexOf(arrSite[3]) != -1 ) { // Обновление резюме из SuperJob
                        if (tabs[0].url.indexOf('search_resume') == -1) {
                            // Запускаем процесс обработки резюме
                            processingSJ(Settings, tabs[0].url, port)
                        } else {
                            // port.postMessage({ "mode" : "close"});
                            port.postMessage({ "log" : 'К сожалению, действий на данной странице не обнаружено'})
                        }
                    } else {
                        port.postMessage({ "log" : 'К сожалению данный сайт еще не поддерживается функцией автоматического импорта кандидатов!'})
                    }
                });
            break;

            case 'getSDname':
                debugLogs('Ветка проверки соединения с Service Desk', 'debug')
                verifServiceDeskTOKEN(updateSettings(), port)
                getNameEmpl(updateSettings())
            break;

            case 'getHHsecrets':
                debugLogs('Ветка получения ключей от HH.ru', 'debug')
                verifServiceDeskTOKEN(updateSettings())
                getHHsecrets(updateSettings())
            break;

            default:
                console.log(msg)
            break;
        }
    });
})

// Слушатели для создания Badge
// При переходте на уже существующую страницу
chrome.tabs.onActivated.addListener(function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        activeTab = tabs[0]
        renderBadge(activeTab)
    });
});
// При открытии новой страницы
chrome.tabs.onCreated.addListener( activeTab => {
    renderBadge(activeTab)
});

