// Метод для получения Auth кода HH
function getAuthCodeHH(Settings, notValid = false) {
    let hhClientID = Settings.Client_id_hh

    if (
        !notValid &&
        Settings.hh_authorization_code && 
        Settings.hh_authorization_code != '' && 
        Settings.hh_authorization_code !== undefined
    ) {
        return Settings.hh_authorization_code
    } else {
        debugLogs('Попытка открыть окно с авторизацией HH.ru', 'debug')
        chrome.tabs.create({url: `https://hh.ru/oauth/authorize?response_type=code&client_id=${hhClientID}`, selected: true})
    }
  
}
// Метод для генирации нового токена HH
function genHHToken(port = null) {

    Settings = updateSettings()

    fetch('https://hh.ru/oauth/token', { 
        method: "POST",
        body: `grant_type=authorization_code&client_id=${Settings.Client_id_hh}&client_secret=${Settings.Client_secret_hh}&code=${Settings.hh_authorization_code}`,
        headers: {
            "Content-Type":"application/x-www-form-urlencoded",
        },
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.error == "invalid_grant" || data.error == "invalid_client") {
            debugLogs(`При выполнении genHHToken(${Settings.hh_authorization_code}) произошла ошибка ${data.error}`, 'error')
            chrome.storage.local.remove(["hh_authorization_code"])
            setTimeout(hhTOKEN, 500, updateSettings(), port)
        } else {
            if (data.access_token) {

                // На основе входящих данных получаем дату смерти токена 
                var deadLineToken = new Date()
                deadLineToken.setSeconds( deadLineToken.getSeconds() + data.expires_in )
                
                // Записываем все данные в память
                chrome.storage.local.set({
                    "hh_token": data.access_token,
                    "hh_token_deadline": deadLineToken.getTime(),
                    "hh_refresh_token": data.refresh_token
                });
            
                updateTokenHHOnSD(updateSettings())
                return data.access_token
            } else {
                debugLogs('При выполнении genHHToken() произошла неизвестная ошибка!' + data.error, 'error')
            }
        }
    })

}

// Метод возвращает свежий токен HH
function hhTOKEN(Settings, port = null) {
    debugLogs('Проверка токена HH', 'debug')
    if (Settings.hh_token && Settings.hh_token != '' & Settings.hh_token !== undefined) {
        if ( new Date() < new Date(Settings.hh_token_deadline) ) {
            debugLogs('Найден активированный токен HH', 'debug')
            return Settings.hh_token
        } else {
            debugLogs('Найден токен HH с истекшим сроком давности, жду 1000мс и повоторяю попытку', 'debug')
            chrome.storage.local.remove([
                "hh_token",
                "hh_authorization_code",
                "hh_token_deadline",
                "hh_refresh_token"
            ])
            setTimeout(hhTOKEN, 1000, updateSettings(), port)
        }
    } else {
        debugLogs('Токен HH не найден, проверка ключей для создания', 'debug')
    
        // Запускаем метод генирации Authorization code
        getAuthCodeHH(updateSettings(), true)

        function awaitAuthCode(updSettings) {
            if (
                updSettings.hh_authorization_code  && 
                updSettings.hh_authorization_code  != '' && 
                updSettings.hh_authorization_code  !== undefined
            ) {
                genHHToken(port)
            } else {
                debugLogs('Жду authorization code 1500мс...', 'debug')
                setTimeout(awaitAuthCode, 1500, updateSettings())
            }
        }
        
        awaitAuthCode(updateSettings())

    }
}

// Метод для получения резюме
async function getResumeOnHHpage(Settings, resumeID, port = null) {
    // Обьявляем переменную для хранения резюме
    let resume = null

    if (Settings.hh_token && Settings.hh_token != '' && Settings.hh_token !== undefined) {
        let hh_token = Settings.hh_token
        debugLogs('Токен hh.ru - На месте', 'debug', port)

        let response = await fetch(`https://api.hh.ru/resumes/${resumeID}`, { 
            method: "GET",
            headers: {
                "Authorization"     : `Bearer ${hh_token}`,
                "HH-User-Agent"     : `integration Service Desk/2.0 (erilov.na@vitaexpress.ru)`
            }
        })

        if ( response.status == 403 ) {
            resp = JSON.parse(data.response)
        
            // Обработка ошибки token_revoked
            if (resp.errors[0].type == 'oauth' && resp.errors[0].value == 'token_revoked') {
                debugLogs('Обнаружена ошибка ключа HH, попытка исправить', 'debug', port) 
                chrome.storage.local.remove([
                    "hh_authorization_code",
                    "hh_token",
                    "hh_token_deadline"
                ])
                updateSettings()
                chrome.tabs.create({url: `https://hh.ru/oauth/authorize?response_type=code&client_id=${hhClientID}`, selected: true})
            }  else {
                debugLogs(`<b>При обращении к HH, возникла неизвестная ошибка! <br><em>${resp.errors[0].type}: </b>${resp.errors[0].value}</em><br>Обратитесь в Сервис Деск, для решения`, 'error', port)
            }
        } else {
            resume = await response.json();
            debugLogs(resume, 'JSON')
        }
        
        // Формируем резюме
        createResumeHH(Settings, resume, port)
  
    } else {
        debugLogs('Токен HH не найден, ожидание hhTOKEN() 1500мс...', 'warn')
        setTimeout(getResumeOnHHpage, 1500, updateSettings(), resumeID, port)
    }
}

// Метод для формирования полей резюме
function createResumeHH(Settings, resume, port = null) {
    if (resume && resume != '' && resume !== undefined) {
        if (Settings.serverLogin && Settings.serverLogin != '' && Settings.serverLogin !== undefined) {

            debugLogs('Формирую поля резюме', 'debug', port)
            let owner_id = resume.owner.id

            function comments() {
                let arrComments = []
                debugLogs('Ожидаю комментарии в количестве ' + resume.owner.comments.counters.total + ' шт.', 'warn', port)
                if (resume.owner.comments.counters.total > 0) {

                    fetch(resume.owner.comments.url, { 
                        method: "GET",
                        headers: {
                            "Authorization"     : `Bearer ${Settings.hh_token}`,
                            "HH-User-Agent"     : `integration Service Desk/2.0 (erilov.na@vitaexpress.ru)`
                        },
                    })
                    .then((response) => response.json())
                    .then((data) => {
                        data.items.forEach(function(item) {
                            let obj = {"author" : item.author.full_name, "created_at" : item.created_at, "text": item.text}
                            arrComments.push(obj)
                        })
                    })
                }
                return arrComments
            }
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
                return getWords(value.months)

                } else {
                return 'Не указан'
                }
            }
            function reply(value) { // Гражданство (Строка) График работы (Строка)
                let str = ''
                for (let index = 0; index < value.length; index++) {
                    if (index == 0) {
                        str = value[index].name
                    } else {
                        str = str + ', ' + value[index].name
                    }
                }
                return str
            }
            function salary(value) {// Зарплата (Строка)
                if (value != null) {
                return value.amount.toString() + ' ' + value.currency
                } else {
                return "Не указано"
                }
            }
            function education_list(value) { // Список учебных заведений
                if (value && value !== undefined && value != []) {
                let education_list = []
                for (let index = 0; index < value.length; index++) {
                    let body = {
                    'metaClass' :'orgResume$education',
                    'year': value[index].year,
                    'title': value[index].name,
                    'position': value[index].organization + ', ' + value[index].result
                    };
                    education_list.push(body)
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
                    'title': value[index].company,
                    'position': value[index].position,
                    'responsibiliti': value[index].description,
                    "startWork": value[index].start,
                    "finishWork": value[index].end
                    };
                    experience_list.push(body)
                }
                return experience_list
                } else {
                return []
                }
            }
            function additional_list(value) { // Список повышений квалификации, курсов
                if (value && value !== undefined && value != []) {
                let additional_list = []
                for (let index = 0; index < value.length; index++) {
                    let body = {
                    'metaClass' :'orgResume$additional',
                    'year': value[index].year,
                    'title': value[index].name,
                    'type': value[index].result,
                    'company' : value[index].organization
                    };
                    additional_list.push(body)
                }
                return additional_list
                } else {
                return []
                }
            }

            function processing(data) {
                
                // Создаётся объект promise для формирования всех полей
                let processingCreatedHHResume = new Promise((resolve) => {

                    let name = ''
                    let phone
                    let email
                    let ageApplicant
                    let applicant = null

                    if (data.type == 'found') {
                        name = data.name // ФИО
                        email = data.email // E-Mail
                        ageApplicant = parseInt(data.age) // Возраст
                        applicant = data.UUID

                        if (data.phone_number != null && data.phone_number != 'null') {
                            phone = data.phone_number // Номер
                        }
                    } else { // Если данных о соискателе не найдено в базе
                        // ФИО

                        if (resume.last_name != '' && resume.last_name != null && resume.last_name !== undefined) name += resume.last_name
                        if (resume.first_name != '' && resume.first_name != null && resume.first_name !== undefined) name += ' ' + resume.first_name
                        if (resume.middle_name != '' && resume.middle_name != null && resume.middle_name !== undefined) name += ' ' + resume.middle_name
                        // Номер
                        if (checkNameOnResume) {
                            phone = resume.contact[0].value.formatted
                            phone = phone.replace(/[.,\/#!$%\^&\*;:{}=\-+_`~() ]/g,"")
                            if (phone.substr(0, 1) == '7') {
                                phone = '8' + phone.substr(1, phone.length)
                            }
                        } else {
                            try {
                                phone = resume.contact[0].value.formatted
                                phone = phone.replace(/[.,\/#!$%\^&\*;:{}=\-+_`~() ]/g,"")
                                if (phone.substr(0, 1) == '7') {
                                phone = '8' + phone.substr(1, phone.length)
                                }
                            } catch (e) {
                                debugLogs('Телефонного номера не обнаружено', 'error', port)
                            }
                        }

                        // E-Mail
                        for (index=0; index < resume.contact.length; index++) {
                            if (resume.contact[index].type.id = 'email') {
                                email = resume.contact[index].value
                            }
                        }
                    }

                    
                    let body = {
                        'metaClass' : 'resume$resume',
                        'applicant': applicant,
                        'owner_id' : owner_id,
                        'title' : name,
                        'description': resume.skills,
                        'address': resume.area.name,
                        'trip' : resume.business_trip_readiness.name,
                        'nationality': reply(resume.citizenship),
                        'schedule' : reply(resume.schedules),
                        'phone' : phone,
                        'birthday' : resume.birth_date,
                        'skills' : resume.skill_set,
                        'email' : email,
                        'salary' : salary(resume.salary),
                        'education_list' : education_list(resume.education.primary),
                        'experience_list' : experience_list(resume.experience),
                        'additional_list' : additional_list(resume.education.additional),
                        'moving': resume.relocation.type.name,
                        'experience': experience(resume.total_experience),
                        'education' : resume.education.level.name + ' образование',
                        'sex' : resume.gender?.name ? resume.gender?.name : null,
                        'link' : '<a href="https://samara.hh.ru/resume/' + resume.id + '">hh.ru</a>',
                        'field' : resume.title,
                        'system_icon' : 'hh',
                        'HR_id' : resume.id,
                        'comments' : comments(),
                        'author' : Settings.serverLogin
                    }

                    if (resume.photo != null) { // Фотография
                        if (resume.photo.medium && resume.photo.medium != '' && resume.photo.medium !== undefined) {
                            toDataURL(resume.photo.medium).then(dataUrl => {
                                body.photo = dataUrl
                            })
                        } else {
                            body.photo = []
                        }
                    } else { body.photo = [] }

                    if (resume.age && resume.age !== undefined && resume.age != null) { // Возраст
                        body.age = resume.age
                    }
                    
                    if (ageApplicant !== undefined && ageApplicant != null) {
                        body.age = ageApplicant
                    }
                
                    resolve(body);

                });

                // Отправляю резюме
                processingCreatedHHResume.then( resumeBody => {
                    sendResume(Settings, resumeBody, port)
                });

                
            }

            findApplicantByID(Settings, owner_id, function(data) {
                if ( resume.first_name == null || resume.first_name == undefined || resume.first_name == '') { // Нету основных данных
                    if (checkNameOnResume) {
                        if (data.type == 'found') {
                            processing(data)
                        } else {
                            debugLogs('Нету основных данных', 'error', port)
                            port.postMessage({'alert': 'Расширениене не увидело основных данных о кандидаде, нажмите кнопку "Показать контакты" и повторите попытку'})
                            port.postMessage({ "mode" : "close"});
                        }
                    } else {
                        processing(data)
                    }
                } else { // Данные получены успешно
                    processing(data)
                }
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