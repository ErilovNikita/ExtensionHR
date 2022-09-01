// Порт для общения с беком
var port = chrome.runtime.connect({ name: "SettingsView" });

// Переменная с настройками
let Settings = {}
// Метод для обновления настроек
function updateSettings() {
    var initSettings = getAllStorageSyncData().then(items => {
        Object.assign(Settings, items);
    });
}
// Метод для получения всех данных из Chrome.Strorage.Local
function getAllStorageSyncData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(items);
        });
    });
}
// Метод для определния работоспособности кнопок
function enabledButtonsViews() {
	let buttonIDArray = [
		'startUpdateKeysAvito',
		'startUpdateKeysHH',
		'removeSDKeys'
	]

	if (Settings.hh_token || (Settings.Client_secret_hh && Settings.Client_id_hh)) {
		document.getElementById(buttonIDArray[1]).disabled = false;
	}
	if (Settings.ServiceDeskTOKEN) {
		document.getElementById(buttonIDArray[2]).disabled = false;
	}
}

// Запускаю обновление настроек
updateSettings()

// Жду полной загрузки страницы
window.onload = function () {

	// Запускам обьявление кнопок токенов
	enabledButtonsViews()

	// Получаем обьект манифеста и заполяем данные
	let manifest = chrome.runtime.getManifest();
	document.getElementsByClassName('extensionName')[0].innerHTML = manifest.name
	document.getElementsByClassName('extensionName')[1].innerHTML = manifest.name
	document.getElementsByClassName('extensionLogo')[0].src = manifest.icons[128]
	document.getElementById('extensionVersion').innerHTML = manifest.version

	// Если данные есть заполяем поле
	if ( Settings.serverLogin !== undefined ) {
		document.getElementById('app_server_login').value = Settings.serverLogin
	}

	// Если данные не пусты
	if (Settings.serverLogin && Settings.serverLogin !== undefined && Settings.serverLogin != '') {

		// View Settings
		document.getElementsByClassName("getDate")[0].classList.add('d-none')
		document.getElementsByClassName("error")[0].classList.add('d-none')
		document.getElementsByClassName("success")[0].classList.add('d-none')
		document.getElementsByClassName("connected")[0].classList.remove('d-none')
		document.getElementsByClassName("notif")[0].classList.add('d-none')
		document.getElementById("step2").classList.add('active')
		document.getElementById("step1").classList.remove('active')

		// View Data
		document.getElementById("mail").innerHTML = Settings.serverLogin

		let firstUpdate = true
		let countConnect = 0

		function updateDataView() {
			countConnect++

			if ( Settings.sdName && Settings.sdName != '' ) {
				document.getElementById('name').innerHTML = Settings.sdName
				document.getElementById('color-state').innerHTML = '🟢'
				document.getElementById('state').innerHTML = 'Подключено'
				// Get HH Secrets
				if (!Settings.Client_id_hh || !Settings.Client_secret_hh || Settings.Client_id_hh == 'undefined' || Settings.Client_secret_hh == 'undefined') {
					port.postMessage("getHHsecrets");
				}
				// Get HH Secrets
				if (!Settings.Client_id_sj || !Settings.Client_secret_sj || Settings.Client_id_sj == 'undefined' || Settings.Client_secret_sj == 'undefined') {
					port.postMessage("getSJsecrets");
				}
			} else {
				if (countConnect > 5) {
					document.getElementById('name').innerHTML = 'Неизвестно'
					document.getElementById('color-state').innerHTML = '🔴'
					document.getElementById('state').innerHTML = 'Не подключено'
				}
			}
			setTimeout(updateDataView, 1000)
		}

		if (firstUpdate) {
			firstUpdate = false
			port.postMessage("getSDname");
			updateDataView()
		} else {
			setTimeout(updateDataView, 1000)
		}

	}

	// Кнопка "Сохранить"
	document.getElementById( "SaveButton" ).onclick = function(event) {
		document.getElementById("SaveButton").disabled = true;
		setTimeout(function() { document.getElementById("SaveButton").disabled = false; }, 1000);

		if (document.getElementById('app_server_login').value != '' && document.getElementById('app_server_login').value !== undefined ) {
			// Success page
			document.getElementsByClassName("getDate")[0].classList.add('d-none')
			document.getElementsByClassName("error")[0].classList.add('d-none')
			document.getElementsByClassName("success")[0].classList.remove('d-none')
			document.getElementsByClassName("connected")[0].classList.add('d-none')

			document.getElementById("step1").classList.remove('active')
			document.getElementById("step2").classList.add('active')

			chrome.storage.local.set({"serverLogin": document.getElementById('app_server_login').value});
			chrome.storage.local.set({"sdName": ''});
			updateSettings()
			document.location.reload()

		} else {
			// Error page
			document.getElementsByClassName("getDate")[0].classList.add('d-none')
			document.getElementsByClassName("error")[0].classList.remove('d-none')
			document.getElementsByClassName("success")[0].classList.add('d-none')
			document.getElementsByClassName("connected")[0].classList.add('d-none')

			document.getElementById("step1").classList.add('error')
			document.location.reload()
		}
	}

	// Кнопка "Закрыть"
	document.getElementById( "closedBtn1" ).onclick = function(event) {
		document.getElementById("closedBtn1").disabled = true;
		setTimeout(function() { document.getElementById("closedBtn1").disabled = false; }, 1000);
		window.close()
	}

	// Кнопка "Закрыть"
	document.getElementById( "closedBtn2" ).onclick = function(event) {
		document.getElementById("closedBtn2").disabled = true;
		setTimeout(function() { document.getElementById("closedBtn2").disabled = false; }, 1000);
		window.close()
	}

	// Кнопка "Закрыть"
	document.getElementById( "closedBtn3" ).onclick = function(event) {
		document.getElementById("closedBtn3").disabled = true;
		setTimeout(function() { document.getElementById("closedBtn3").disabled = false; }, 1000);
		window.close()
	}

	// Перезапуск страницы
	document.getElementById( "reload" ).onclick = function(event) {
		document.getElementById("reload").disabled = true;
		setTimeout(function() { document.getElementById("reload").disabled = false; }, 1000);
		document.location.reload()
	}

	// Перезапуск страницы
	document.getElementById( "reload2" ).onclick = function(event) {
		document.getElementById("reload2").disabled = true;
		setTimeout(function() { document.getElementById("reload2").disabled = false; }, 1000);
		document.location.reload()
	}

	// edit page (Go generic) btn
	document.getElementById( "edit" ).onclick = function(event) {
		document.getElementById("edit").disabled = true;
		setTimeout(function() { document.getElementById("edit").disabled = false; }, 1000);
		chrome.storage.local.set({"serverLogin": ''});
		updateSettings()
		document.location.reload()
	}

	// Check page (Go generic) btn
	document.getElementById( "check" ).onclick = function(event) {
		document.getElementById("check").disabled = true;
		setTimeout(function() { document.getElementById("check").disabled = false; }, 1000);
		document.location.reload()
	}

	// Open&Close menu modal btn
	document.getElementById('menu').getElementsByClassName('button')[0].onclick = function(event) {
		document.getElementById('menu').getElementsByClassName('button')[0].disabled = true;
		setTimeout(function() { document.getElementById('menu').getElementsByClassName('button')[0].disabled = false; }, 1000);
		if ( document.getElementById('menu').getElementsByClassName('list-group')[0].classList.contains('d-none') ) {
			document.getElementById('menu').getElementsByClassName('list-group')[0].classList.remove('d-none')
		} else {
			document.getElementById('menu').getElementsByClassName('list-group')[0].classList.add('d-none')
		}
		
	}

	// startUpdateKeysHH
	document.getElementById( "startUpdateKeysHH" ).onclick = function(event) {
		document.getElementById("startUpdateKeysHH").disabled = true;
		setTimeout(function() { document.getElementById("startUpdateKeysHH").disabled = false; }, 1000);

		chrome.storage.local.remove(['hh_authorization_code', 'hh_token', 'hh_token_deadline']);
		updateSettings()

		document.location.reload()
		window.open('https://hh.ru/oauth/authorize?response_type=code&client_id=' + Settings.Client_id_hh, '_blank').focus();
	}

	// removeSDKeys
	document.getElementById( "removeSDKeys" ).onclick = function(event) {
		document.getElementById("removeSDKeys").disabled = true;
		setTimeout(function() { document.getElementById("removeSDKeys").disabled = false; }, 1000);

		chrome.storage.local.remove(['ServiceDeskTOKEN']);
		updateSettings()
		document.location.reload()
	}
}
