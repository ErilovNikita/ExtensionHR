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
        debugLogs('Попытка открыть окно с авторизацией Хабр Карьера', 'debug')
        let redirectURL = encodeURIComponent('https://career.habr.com/companies/vitaexpress')
        chrome.tabs.create({
            url: `https://career.habr.com/integrations/oauth/authorize?client_id=${habrClientID}&redirect_uri=${redirectURL}&response_type=code`, 
            selected: true
        })
    }
  
}

// Метод для генирации нового токена habr
function genHabrToken(port = null) {

    Settings = updateSettings()
    let redirectURL = encodeURIComponent('https://career.habr.com/companies/vitaexpress')

    fetch('https://career.habr.com/integrations/oauth/token', { 
        method: "POST",
        body: `grant_type=authorization_code&client_id=${Settings.Client_id_habr}&client_secret=${Settings.Client_secret_habr}&code=${Settings.habr_authorization_code}&redirect_uri=${redirectURL}`,
        headers: {
            "Content-Type":"application/x-www-form-urlencoded",
        },
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.error == "invalid_grant" || data.error == "invalid_client") {
            debugLogs(`При выполнении genHabrToken(${Settings.habr_authorization_code}) произошла ошибка ${data.error}`, 'error')
            chrome.storage.local.remove(["habr_authorization_code"])
            setTimeout(habrTOKEN, 2000, updateSettings(), port)
        } else {
            if (data.access_token) {

                // На основе входящих данных получаем дату смерти токена (10 минут жизни)
                let createdDateTime = new Date(data.created_at )
                let deadLineToken = new Date(createdDateTime.getTime() + 10 * 60000)

                // Записываем все данные в память
                chrome.storage.local.set({
                    "habr_token": data.access_token,
                    "habr_token_deadline": deadLineToken.getTime()
                });

                updateSettings()
            
                //updateTokenHabrOnSD(updateSettings())
                return data.access_token
            } else {
                debugLogs('При выполнении genHabrToken() произошла неизвестная ошибка!' + data.error, 'error')
            }
        }
    })

}

// Метод возвращает свежий токен Habr
function habrTOKEN(Settings, port = null) {
    debugLogs('Проверка токена Habr', 'debug')
    if (Settings.habr_token && Settings.habr_token != '' & Settings.habr_token !== undefined) {
        if ( new Date() < new Date(Settings.habr_token_deadline) ) {
            debugLogs('Найден активированный токен Habr', 'debug')
            return Settings.habr_token
        } else {
            debugLogs('Найден токен Habr с истекшим сроком давности, жду 1500мс и повоторяю попытку', 'debug')
            chrome.storage.local.remove([
                "habr_token",
                "habr_authorization_code",
                "habr_token_deadline",
                "habr_refresh_token"
            ])
            setTimeout(habrTOKEN, 1500, updateSettings(), port)
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

// Метод для получения резюме
async function getResumeOnHabrPage(Settings, resumeID, port = null) {
    // Обьявляем переменную для хранения резюме
    let resume = null

    if (Settings.habr_token && Settings.habr_token != '' && Settings.habr_token !== undefined) {
        let habr_token = Settings.habr_token
        let habrClientID = Settings.Client_id_habr

        debugLogs('Токен Хабр Карьера - На месте', 'debug', port)

        let response = await fetch(`https://career.habr.com/api/v1/integrations/users/${resumeID}`, { 
            method: "GET",
            headers: {
                "Authorization"     : `Bearer ${habr_token}`
            }
        })

        if ( response.status == 403 ) {
            resp = JSON.parse(data.response)
        
            // Обработка ошибки token_revoked
            if (resp.errors[0].type == 'oauth' && resp.errors[0].value == 'token_revoked') {
                debugLogs('Обнаружена ошибка ключа Хабр Карьера, попытка исправить', 'debug', port) 
                chrome.storage.local.remove([
                    "habr_authorization_code",
                    "habr_token",
                    "habr_token_deadline"
                ])
                updateSettings()
                
                debugLogs('Попытка открыть окно с авторизацией Хабр Карьера', 'debug')
                let redirectURL = encodeURIComponent('https://career.habr.com/companies/vitaexpress')
                chrome.tabs.create({
                    url: `https://career.habr.com/integrations/oauth/authorize?client_id=${habrClientID}&redirect_uri=${redirectURL}&response_type=code`, 
                    selected: true
                })
        
            }  else {
                debugLogs(`<b>При обращении к Хабр Карьера, возникла неизвестная ошибка! <br><em>${resp.errors[0].type}: </b>${resp.errors[0].value}</em><br>Обратитесь в Сервис Деск, для решения`, 'error', port)
            }
        } else {
            resume = await response.json();
            debugLogs(resume, 'JSON')
        }
        
        // Формируем резюме
        createResumeHabr(Settings, resume, port)
  
    } else {
        debugLogs('Токен Хабр Карьера не найден, ожидание habrTOKEN() 1500мс...', 'warn')
        setTimeout(getResumeOnHabrPage, 1500, updateSettings(), resumeID, port)
    }
}

// Метод для формирования полей резюме
function createResumeHabr(Settings, resume, port = null) {
    if (resume && resume != '' && resume !== undefined) {
        if (Settings.serverLogin && Settings.serverLogin != '' && Settings.serverLogin !== undefined) {

            debugLogs('Формирую поля резюме', 'debug', port)

            function experience(value) { // Рабочий стаж (Строка)
                if (value != null) {

                    function getWords(monthCount) {
                        function getPlural(number, word) {
                            return number === 1 && word.one || word.other;
                        }

                        var months = { one: 'месяц', other: 'месяцев' },
                            years = { one: 'год', other: 'лет' },
                            m = monthCount % 12,
                            y = Math.floor(monthCount / 12),
                            result = [];

                        y && result.push(y + ' ' + getPlural(y, years));
                        m && result.push(m + ' ' + getPlural(m, months));
                        return result.join(' и ');
                    }
                    return getWords(value)

                } else {
                    return 'Не указан'
                }
            }
            function salary(value) {// Зарплата (Строка)
                if (value.from != null) {
                    return value.from.toString() + ' ' + value.currency
                } else {
                    return "Не указано"
                }
            }
            function education_list(value) { // Список учебных заведений
                if (value && value !== undefined && value != []) {
                    let education_list = []
                    for (education of value) {
                        education_list.push({
                            'metaClass' :'orgResume$education',
                            'year': education.end_date ? education.end_date.split('-')[0] : null,
                            'experienceDesc' : education.description ? education.education : null,
                            'title': education.university_name,
                            'position': position
                        })
                    }
                    return education_list
                } else {
                    return []
                }
            }
            function experience_list(value) { // Список прошлых мест работы
                if (value && value !== undefined && value != []) {
                    let experience_list = []
                    for (let index = 0; index < value.length; index++) {
                        let body = {
                            'metaClass' :'orgResume$experience',
                            'title': value[index].company_name,
                            'position': value[index].position,
                            'responsibiliti': value[index].description ? value[index].description.replaceAll('<p>', '').replaceAll('</p>', '') : null,
                            "startWork": value[index].start_date,
                            "finishWork": value[index].end_date
                        };

                        if (value[index].skills.length > 0) {
                            body.responsibiliti += "<br><br>"
                            for (skill of value[index].skills) {
                                body.responsibiliti += `<b>${skill.title}</b>  `
                            }
                        }

                        experience_list.push(body)
                    }
                    return experience_list
                } else {
                    return []
                }
            }
            function getLocation(value) { // Метод получения адреса
                let result = null
                if (value.country) {
                    result = value.country
                    if (value.city) {
                        result += ', ' + value.city
                    }
                }
                return result
            }
            function getSkills(value) { // Скилы
                let result = []
                if (value.length > 0) {
                    for (skill of value) {
                        result.push(skill.title)
                    }
                }
                return result
            }
            function getContact(contacts, attr) {
                switch (attr) {
                    case 'phone':
                        if (contacts.phones.length > 0) { return contacts.phones[0].value } else {return null}

                    case 'email':
                        if (contacts.emails.length > 0) { return contacts.emails[0].value } else {return null}

                    case 'telegram':
                        if (contacts.messengers.length > 0) { 
                            for (account of contacts.messengers) {
                                if (account.type == 'telegram') {
                                    return account.value 
                                }
                            }
                            return null
                        } else {
                            return null
                        }
                    
                    case 'skype':
                        if (contacts.messengers.length > 0) { 
                            for (account of contacts.messengers) {
                                if (account.type == 'skype') {
                                    return account.value 
                                }
                            }
                            return null
                        } else {
                            return null
                        }
                
                    default: 
                        return null
                }
            }
            function getDescription(value) {
                if (value) {
                    return resume.about.replaceAll('<p>', '').replaceAll('</p>', '')
                } else {
                    return null
                }
            }

            // Создаётся объект promise для формирования всех полей
            let processingCreatedHabrResume = new Promise((resolve) => {
                
                let body = {
                    'metaClass' : 'resume$resume',
                    'applicant': null,
                    'owner_id' : null,
                    'title' : resume.full_name,
                    'age' : resume.age,
                    'description': getDescription(resume.about),
                    'address': getLocation(resume.location),
                    'trip' : null,
                    'nationality': null,
                    'schedule' : resume.remote ? 'Готов к удаленной работе' : 'Не готов к удаленной работе',
                    'phone' : getContact(resume.contacts, 'phone'),
                    'telegram' : getContact(resume.contacts, 'telegram'),
                    'skype' : getContact(resume.contacts, 'skype'),
                    'birthday' : resume.birthday,
                    'skills' : getSkills(resume.skills),
                    'email' : getContact(resume.contacts, 'email'),
                    'salary' : salary(resume.salary),
                    'education_list' : education_list(resume.university_educations),
                    'experience_list' : experience_list(resume.experiences),
                    'additional_list' : [],
                    'moving': resume.relocation ? 'Готов к переезду' : 'Не готов к переезду',
                    'experience': experience(resume.experience_total),
                    'education' : null,
                    'sex' : null,
                    'link' : '<a href="https://career.habr.com/' + resume.login + '">career.habr.com</a>',
                    'field' : resume.specializations[0].title,
                    'system_icon' : 'habr',
                    'HR_id' : resume.login,
                    'comments' : [],
                    'author' : Settings.serverLogin
                }

                // Фотография
                if (resume.avatar != null) { 
                    if (resume.avatar && resume.avatar != '' && resume.avatar !== undefined) {
                        body.photoUrl = resume.avatar
                    } else {
                        body.photo = []
                    }
                } else { body.photo = [] }
            
                resolve(body);

            });

            // Отправляю резюме
            processingCreatedHabrResume.then( resumeBody => {
                sendResume(Settings, resumeBody, port)
            });

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