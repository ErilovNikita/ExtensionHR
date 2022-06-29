var port = chrome.runtime.connect({ name: "HHPage" });

// Обработка ответов через порт
port.onMessage.addListener(function(response) { 
	if (response.alert) {
		alert(response.alert)
	} else {
		if (!response.log) {
		console.log(response)
		}
	}
});

if ( window.location.href.indexOf('hh.ru/oauth/authorize?response_type=code&client_id=') != -1 ) {  // HH API ALERT ONLY
	alert('Внимание!\nДля корректного обновления ключей, после нажатия кнопки продолжить, дождитесь всплывающего окна с результатом обновления ')
}

if ( window.location.href.indexOf('https://samara.hh.ru/employer/edit/simple') != -1 &&  window.location.href.indexOf('code=') != -1) {  // HH API
	window.onload = function () {
		let arr = { "hh_authorization_code": window.location.href.substr( window.location.href.indexOf('code=') + 5, window.location.href.length) }
		chrome.runtime.sendMessage(arr, function (response) {
			console.log(response);
		});
		alert('Внимание!\nБыло выполнено автоматическое обновление API ключей, можете закрыть вкладку и повторно вызвать расширения для импорта резюме')
	}
}
