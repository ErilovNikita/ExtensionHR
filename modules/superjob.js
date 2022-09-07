// Метод возвращает свежий токен SJ
function sjTOKEN(Settings, port = null) {
    debugLogs('Проверка токена SuperJob', 'debug')
    if (Settings.sj_token && Settings.sj_token != '' & Settings.sj_token !== undefined) {
        if ( new Date() < new Date(Settings.sj_token_deadline) ) {
            debugLogs('Найден активированный токен SuperJob', 'debug')
            return Settings.sj_token
        } else {
            debugLogs('Найден токен SuperJob с истекшим сроком давности, жду 1000мс и повоторяю попытку', 'debug')
            chrome.storage.local.remove([
                "sj_token",
                "sj_token_deadline",
            ])
            setTimeout(sjTOKEN, 1000, updateSettings(), port)
        }
    } else {
        debugLogs('Токен SuperJob не найден, проверка ключей для создания', 'debug')

        // Запускаем метод генирации Authorization code
        getAuthCodeSJ(updateSettings(), true)

        function awaitAuthCode(updSettings) {
            if (
                updSettings.sj_authorization_code  && 
                updSettings.sj_authorization_code  != '' && 
                updSettings.sj_authorization_code  !== undefined
            ) {
                genSJToken(port)
            } else {
                debugLogs('Жду authorization code 1500мс...', 'debug')
                setTimeout(awaitAuthCode, 1500, updateSettings())
            }
        }
        
        awaitAuthCode(updateSettings())
    }
}

// Метод для генирации нового токена SJ
function genSJToken(port = null) {

    Settings = updateSettings()
    let redirectURL = 'https://zima.superjob.ru/clients/apteki-vita-2210879.html'

    fetch('https://api.superjob.ru/2.0/oauth2/access_token/', { 
        method: "POST",
        body: `code=${Settings.sj_authorization_code}&client_id=${Settings.Client_id_sj}&client_secret=${Settings.Client_secret_sj}&redirect_uri=${redirectURL}`,
        headers: {
            "Content-Type":"application/x-www-form-urlencoded",
        },
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.error == "invalid_grant" || data.error == "invalid_client") {
            debugLogs(`При выполнении genSJToken(${Settings.sj_authorization_code}) произошла ошибка ${data.error.message}`, 'error')
            chrome.storage.local.remove(["sj_authorization_code"])
            setTimeout(shTOKEN, 500, updateSettings(), port)
        } else {
            if (data.access_token) {

                // На основе входящих данных получаем дату смерти токена 
                var deadLineToken = new Date()
                deadLineToken.setSeconds( deadLineToken.getSeconds() + data.expires_in )
                
                // Записываем все данные в память
                chrome.storage.local.set({
                    "sj_token": data.access_token,
                    "sj_token_deadline": deadLineToken.getTime(),
                    "sj_refresh_token": data.refresh_token
                });
                updateSettings()
                //updateTokenSJOnSD(updateSettings())
                return data.access_token
            } else {
                debugLogs(`При выполнении genSJToken() произошла неизвестная ошибка! ${data.error.message}`, 'error')
            }
        }
    })

}

// Метод для получения Auth кода SJ
function getAuthCodeSJ(Settings, notValid = false) {
    let sjClientID = Settings.Client_id_sj

    if (
        !notValid &&
        Settings.sj_authorization_code && 
        Settings.sj_authorization_code != '' && 
        Settings.sj_authorization_code !== undefined
    ) {
        return Settings.sj_authorization_code
    } else {
        debugLogs('Попытка открыть окно с авторизацией SuperJob.ru', 'debug')
        let redirectURL = encodeURIComponent('https://zima.superjob.ru/clients/apteki-vita-2210879.html')
        chrome.tabs.create({url: `https://www.superjob.ru/authorize?client_id=${sjClientID}&redirect_uri=${redirectURL}`, selected: true})
    }
  
}

// Метод для получения резюме
async function getResumeOnSJpage(Settings, resumeID, port = null) {
    // Обьявляем переменную для хранения резюме
    let resume = null

    if (Settings.sj_token && Settings.sj_token != '' && Settings.sj_token !== undefined) {
        let sj_token = Settings.sj_token
        debugLogs('Токен SuperJob.ru - На месте', 'debug', port)

        let response = await fetch(`https://api.superjob.ru/2.0/resumes/${resumeID}`, { 
            method: "GET",
            headers: {
                "Authorization"     : `Bearer ${sj_token}`,
                "X-Api-App-Id"      : Settings.Client_secret_sj
            }
        })

        if ( response.status == 403 ) {
            resp = JSON.parse(data.response)
        
            // Обработка ошибки token_revoked
            if (resp.errors[0].type == 'oauth' && resp.errors[0].value == 'token_revoked') {
                debugLogs('Обнаружена ошибка ключа SuperJob, попытка исправить', 'debug', port) 
                chrome.storage.local.remove([
                    "sj_authorization_code",
                    "sj_token",
                    "sj_token_deadline"
                ])
                updateSettings()
                let redirectURL = encodeURIComponent('https://zima.superjob.ru/clients/apteki-vita-2210879.html')
                chrome.tabs.create({url: `https://www.superjob.ru/authorize?client_id=${sjClientID}&redirect_uri=${redirectURL}`, selected: true})
            }  else {
                debugLogs(`<b>При обращении к SuperJob, возникла неизвестная ошибка! <br><em>${resp.errors[0].type}: </b>${resp.errors[0].value}</em><br>Обратитесь в Сервис Деск, для решения`, 'error', port)
            }
        } else {
            resume = await response.json();
            debugLogs(resume, 'JSON')
        }
        
        // Формируем резюме
        createResumeSJ(Settings, resume, port)
  
    } else {
        debugLogs('Токен SuperJob не найден, ожидание sjTOKEN() 1500мс...', 'warn')
        setTimeout(getResumeOnSJpage, 1500, updateSettings(), resumeID, port)
    }
}

// Метод для формирования полей резюме
function createResumeSJ(Settings, resume, port = null) {
    if (resume && resume != '' && resume !== undefined) {
        if (Settings.serverLogin && Settings.serverLogin != '' && Settings.serverLogin !== undefined) {

            debugLogs('Формирую поля резюме', 'debug', port)
            let owner_id = resume.id_user

            function comments(value) {
                let arrComments = []
                debugLogs('Ожидаю комментарии в количестве ' + value.length.toString() + ' шт.', 'warn', port)
                if (value.length > 0) {

                    for (comment of value) {
                        let obj = {
                            "author" : comment.author, 
                            "created_at" : new Date(comment.date * 1000).toISOString(), 
                            "text": comment.text
                        }
                        arrComments.push(obj)
                    }
                }
                return arrComments
            }
            function salary(payment, currency) {// Зарплата (Строка)
                let result = ''
                if (payment != null) {
                    result += payment.toString()
                    if (currency != null) {
                        result += currency.toString()
                    }
                } else {
                    result = "Не указано"
                }
                return payment.toString()
            }
            function education_list(value) { // Список учебных заведений
                console.log(value)
                if (value && value !== undefined && value != []) {
                    let education_list = []
                    for (education of value) {
                        education_list.push({
                            'metaClass' :'orgResume$education',
                            'year': education.yearend == 0 ? null : education.yearend,
                            'title': education.institute ? education.institute.title : null,
                            'position': education.faculty && education.profession ? education.faculty + ', ' + education.profession : null
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
                    for (experience of value) {
                        experience_list.push({
                            'metaClass' :'orgResume$experience',
                            'title': experience.name,
                            'position': experience.profession,
                            'responsibiliti':experience.achievements,
                            "startWork": experience.yearbeg && experience.monthbeg ? experience.yearbeg + '-' + experience.monthbeg + '-01' : null,
                            "finishWork": experience.yearend && experience.monthend ? experience.yearend + '-' + experience.monthend + '-01' : null,
                        })
                    }
                    return experience_list
                } else {
                    return []
                }
            }
            function additional_list(value) { // Список повышений квалификации, курсов
                if (value && value !== undefined && value != []) {
                    let additional_list = []
                    for (additional of value) {
                        additional_list.push({
                            'metaClass' :'orgResume$additional',
                            'year': additional.yearend,
                            'title': additional.name,
                            'company' : additional.institute
                        })
                    }
                    return additional_list
                } else {
                    return []
                }
            }

            function processing(data) {
                
                // Создаётся объект promise для формирования всех полей
                let processingCreatedHHResume = new Promise((resolve) => {

                    let phone
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
                        // Номер
                        if (checkNameOnResume) {
                            phone = resume.phone1
                            phone = phone.replace(/[.,\/#!$%\^&\*;:{}=\-+_`~() ]/g,"")
                            if (phone.substr(0, 1) == '7') {
                                phone = '8' + phone.substr(1, phone.length)
                            }
                        } else {
                            try {
                                phone = resume.phone1
                                phone = phone.replace(/[.,\/#!$%\^&\*;:{}=\-+_`~() ]/g,"")
                                if (phone.substr(0, 1) == '7') {
                                    phone = '8' + phone.substr(1, phone.length)
                                }
                            } catch (e) {
                                debugLogs('Телефонного номера не обнаружено', 'error', port)
                            }
                        }

                    }

                    let body = {
                        'metaClass' : 'resume$resume',
                        'applicant': applicant,
                        'owner_id' : owner_id,
                        'title' : resume.name,
                        'description': null,
                        'address': resume.town.title,
                        'trip' : resume.business_trip.title,
                        'nationality': resume.citizenship.title,
                        'schedule' : resume.type_of_work.title + ' занятость',
                        'phone' : phone,
                        'birthday' : resume.birthyear + '-' + resume.birthmonth + '-' + resume.birthday,
                        'skills' : null,
                        'email' : resume.email !== undefined ? resume.email : null,
                        'salary' : salary(resume.payment, resume.currency),
                        'education_list' : education_list(resume.base_education_history),
                        'experience_list' : experience_list(resume.work_history),
                        'additional_list' : additional_list(resume.education_history),
                        'moving': resume.moveable ? 'Готов к переезду' : 'Не готов к переезду',
                        'experience': resume.experience_text,
                        'education' : resume.education.title + ' образование',
                        'sex' : resume.gender?.title ? resume.gender?.title : null,
                        'link' : '<a href="' + resume.link + '">SuperJob.ru</a>',
                        'field' : resume.profession,
                        'system_icon' : 'superjob',
                        'HR_id' : resume.id,
                        'comments' : comments(resume.comments),
                        'author' : Settings.serverLogin
                    }

                    if (resume.photo != null) { // Фотография
                        if (resume.photo_sizes.medium && resume.photo_sizes.medium != '' && resume.photo_sizes.medium !== undefined) {
                            body.photoUrl = resume.photo_sizes.medium
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
                    //console.log(resumeBody)
                    sendResume(Settings, resumeBody, port)
                });

                
            }

            findApplicantByID(Settings, owner_id, function(data) {
                if ( resume.name == null || resume.name == undefined || resume.name == '') { // Нету основных данных
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
                    debugLogs('Пользователь ввел логин, запускаю createResumeSJ()', 'debug')
                    createResumeSJ(Settings, resume, port)
                } else {
                    setTimeout(checkLogin, 1500)
                }
            }

            checkLogin()
        }
    } else {
        debugLogs('Ожидание данных 100мс...', 'warn')
        setTimeout(createResumeSJ, 100, Settings, resume, port)
    }
}