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
                console.log(data)

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

    // Рабочий стаж (Строка)
    function experience(value) {
        if (value && value != '' && value !== undefined) {
            return value.toString()
        } else {
            return 'Не указан'
        }
    }
    // Готовность к командировкам (Строка)
    function trip(value) {
        if (value && value != '' && value !== undefined) {
            return value
        } else {
            return 'Не готов'
        }
    }
    // Переезд (Строка)
    function moving(value) {
        if (value && value != '' && value !== undefined) {
            return value
        } else {
            return "Невозможен"
        }
    }
    // Зарплата (Строка)
    function salary(value) {
        if (value && value != '' && value !== undefined) {
            return value.toString()
        } else {
            return "Не указано"
        }
    }
    // Телефон (Строка)
    function phone(value) {
        if (value && value !== undefined) {
            for (let index = 0; index < value.length; index++) {
                if (value[index].type == 'phone') {
                    let number = value[index].value.replace(/[.,\/#!$%\^&\*;:{}=\-+_`~() ]/g,"")
                    if (number.substr(0, 1) == '7') {
                        number = '8' + number.substr(1, number.length)
                    }
                    return number
                }
            }
        }
    }
    // E-Mail (Строка)
    function email(value) {
        if (value && value !== undefined) {
            for (let index = 0; index < value.length; index++) {
                if (value[index].type == 'e-mail') {
                    return value[index].value
                }
            }
        }
    }
    // Список учебных заведений
    function education_list(value) {
        if (value && value !== undefined) {
            let education_list = []
            for (let index = 0; index < value.length; index++) {
                let body = {
                    'metaClass' :'orgResume$education',
                    'year': parseInt(value[index].education_stop),
                    'title': value[index].institution,
                    'position': value[index].specialty
                };
                education_list.push(body)
            }
            return education_list
        } else {
            return []
        }
    }
    // Список прошлых мест работы
    function experience_list(value) {
        if (value && value !== undefined) {
            let experience_list = []
            for (let index = 0; index < value.length; index++) {
                let body = {
                    'metaClass' :'orgResume$experience',
                    'title': value[index].company,
                    'position': value[index].position,
                    'responsibiliti': value[index].responsibilities,
                    "startWork": value[index].work_start,
                    "finishWork": value[index].work_finish
                };
                experience_list.push(body)
            }
            return experience_list
        } else {
            return []
        }
    }

    let generalData = await getResumeOnAvitoPage(id)
    let contactData = await getContactsOnAvitoPage(id, port)

    // Создаётся объект promise для формирования всех полей
    let processingCreatedAvitoResume = new Promise((successResume) => {
        debugLogs('Формирую тело...', 'debug')

        let body = {
            'metaClass' : 'resume$resume',
            'title' : contactData.name,
            'description': generalData.description,
            'address': generalData.params.address,
            'trip' : trip(generalData.params.ability_to_business_trip),
            'nationality': generalData.params.nationality,
            'schedule' : generalData.params.schedule,
            'phone' : phone(contactData.contacts),
            'email' : email(contactData.contacts),
            'salary' : salary(generalData.salary),
            'education_list' : education_list(generalData.params.education_list),
            'experience_list' : experience_list(generalData.params.experience_list),
            'moving': moving(generalData.params.moving),
            'experience': experience(generalData.params.experience),
            'education' : generalData.params.education,
            'sex' : generalData.params.pol,
            'link' : '<a href="http://avito.ru' + generalData.url + '">Авито</a>',
            'field' : generalData.params.business_area,
            'system_icon' : 'avito',
            'HR_id' : 'avito_' + id,
            'owner_id' : new Date().getTime(),
            'comments' : [],
            'author' : Settings.serverLogin
        };

        // Фотография
        if (generalData.photos && generalData.photos != '' && generalData.photos !== undefined) {
            toDataURL(generalData.photos[0].url).then(dataUrl => {
                body.photo = dataUrl
            })
        } else {
            body.photo = []
        }

        // Возраст
        if (generalData.params.age && generalData.params.age !== undefined && generalData.params.age != null) {
            body.age = generalData.params.age
        }

        successResume(body);

    })

    // Отправляю резюме
    processingCreatedAvitoResume.then( resumeBody => {
        sendResume(Settings, resumeBody, port)
    });
    // });

    
}