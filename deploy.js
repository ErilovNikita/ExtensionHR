// Завистимости
import zipFolder from 'zip-folder'
import fs, { Stats } from 'fs'
import chrome_webstore_upload from 'chrome-webstore-upload'

// Игнорирование ограничений ssl
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

// Константы 
const folder = './src/';
const zipName = 'extension.zip';
const manifest = JSON.parse(fs.readFileSync(folder + `manifest.json`))

const webStore = chrome_webstore_upload({
  extensionId: 'ibbbcfhmdgiamboockeeikolhmnheelj',
  clientId: '138811529522-imfjkc6pgb8e3v6414d9s4vspnuv1v7b.apps.googleusercontent.com',
  clientSecret: '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',
  refreshToken: '1//0cMXodbAjTdHxCgYIARAAGAwSNwF-L9Irv2Nk10jqCjerD3zkNkHgxCnqNJjejsZadAzctYtw4REjck9ANZ-LybH0dRWGqC14tlE'
});

// Метод для загрузки расширения
function uploadExtension() {
  // Создаем стрим из файла для выгрузки
  const extensionSource = fs.createReadStream(`./${zipName}`);

  // Выгружаем новую версию в магазин
  webStore.uploadExisting(extensionSource).then(res => {
    console.log('Архив успешно загружен в интернет-магазин chrome');

    // Публикация
    webStore.publish().then(res => { // Успех
      let status = res['statusDetail'][0].toString()
      if (status == 'OK.' ) {
        console.log('Новая версия успешно опубликована');
      } else {
        console.log(`Ошибка при публикации новой версии: ${res['statusDetail']}`);
        process.exit(1);
      }
    }).catch((error) => { // Ошибка
      console.log(`Ошибка при публикации расширения: ${error}`);
      process.exit(1);
    });

  }).catch((error) => {
    console.log(`Ошибка при загрузке архива: ${error}`);
    process.exit(1);
  });
}

console.log('Обнаружена версия расширения ' + manifest.version);

// Основной код
// Архивируем папку с расширением 
zipFolder(folder, zipName, function (err) {
  if (err) { // Ошибка
    console.log('Ошибка!', err);
    process.exit(1);
  } else { // Успех
    console.log(`Успешно запакована папка "${folder}" и сохранена с именем - ${zipName}`);
    // В случае успеха запускаем выгрузку архива в магазин
    uploadExtension();
  }
});