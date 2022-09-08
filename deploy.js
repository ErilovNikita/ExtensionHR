import zipFolder from 'zip-folder'
import fs from 'fs'
import chrome_webstore_upload from 'chrome-webstore-upload'

let folder = './src/';
let zipName = 'extension.zip';

const webStore = chrome_webstore_upload({
  extensionId: 'ibbbcfhmdgiamboockeeikolhmnheelj',
  clientId: '138811529522-imfjkc6pgb8e3v6414d9s4vspnuv1v7b.apps.googleusercontent.com',
  clientSecret: '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',
  refreshToken: '1//0cMXodbAjTdHxCgYIARAAGAwSNwF-L9Irv2Nk10jqCjerD3zkNkHgxCnqNJjejsZadAzctYtw4REjck9ANZ-LybH0dRWGqC14tlE'
});

// zipping the output folder
zipFolder(folder, zipName, function (err) {
  if (err) {
    console.log('oh no!', err);
    process.exit(1);
  } else {
    console.log(`Successfully Zipped ${folder} and saved as ${zipName}`);
    uploadZip(); // on successful zipping, call upload 
  }
});

function uploadZip() {
  // creating file stream to upload
  const extensionSource = fs.createReadStream(`./${zipName}`);

  // upload the zip to webstore
  webStore.uploadExisting(extensionSource).then(res => {
    console.log('Successfully uploaded the ZIP');

    // publish the uploaded zip
    webStore.publish().then(res => {
      console.log('Successfully published the newer version');
    }).catch((error) => {
      console.log(`Error while publishing uploaded extension: ${error}`);
      process.exit(1);
    });

  }).catch((error) => {
    console.log(`Error while uploading ZIP: ${error}`);
    process.exit(1);
  });
}