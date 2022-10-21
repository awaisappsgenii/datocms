const { buildClient } = require('@datocms/cma-client-node');
// const data = require("./exports/category/es.json");
const data = require("./exports/wordpressJson/es.json");

const englishSuccessLogs = require("./output/temp/en_successLogs.json");
const englishErrorLogs = require("./output/temp/en_errorLogs.json");


const { mapJsonContent, updateDatoUrlInString, xml2jsonConverter } = require('./utils/helpers');
const wordpressMediaJson = require("./exports/wordpressMappedJson/en.json");
const { fetchFromElastic } = require('./utils/helpers');
const successLogs = require("./output/successLogs.json");

const elasticData = require("./output/elasticData/category_es.json");

const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');
//To convert dato
const datoCMSApiToken = 'b536e18070d6712b859b724cddd153'

const errorUrls = [];
const successfulUrls = [];

const bulkMediaUploader = async () => {
  console.log(`started at ${moment().format('llll')} for ${wordpressMediaJson.length} records` );
  const startedTime = moment().valueOf();
  // await Promise.all(wordpressMediaJson.map(async (element,index) => {
  //   if (index <= 5) {
  //     await run(element)
  //   }
  // }));

  // const chunks = _.chunk(wordpressMediaJson, 20);

  // await Promise.all(chunks[0].map(async (element,index) => {
  //   // if (index <= 5) {
  //     await run(element, index)
  //   // }
  // }));

  // wordpressMediaJson.forEach(async (element, index) => {
  //   await run(element, index)
  // })

  for (let index = 0; index < wordpressMediaJson.length; index++) {
    const element = wordpressMediaJson[index];
    await run(element, index)
  };

  // await Promise.all(wordpressMediaJson.map(async (element,index) => {
  //   // if (index <= 5) {
  //     await run(element, index)
  //   // }
  // }));

  console.log("ended at " + moment().format('llll'));
  const endedTime = moment().valueOf();

  console.log("Time Taken " + moment(endedTime - startedTime).format('mm:ss'));

  const errorLogs = JSON.stringify(errorUrls);
  const successLogs = JSON.stringify(successfulUrls);
  fs.writeFile("output/errorLogs.json", errorLogs, 'utf8', function (err) {
      if (err) {
          return console.log(err);
      }
      console.log("Success Log file saved!");
  });

  fs.writeFile("output/successLogs.json", successLogs, 'utf8', function (err) {
    if (err) {
        return console.log(err);
    }
    console.log("Error Log file saved!");
  });
};


function handleProgress(info) {
    // info.type can be one of the following:
    //
    // * DOWNLOADING_FILE: client is downloading the asset from the specified URL
    // * REQUESTING_UPLOAD_URL: client is requesting permission to upload the asset to the DatoCMS CDN
    // * UPLOADING_FILE: client is uploading the asset
    // * CREATING_UPLOAD_OBJECT: client is finalizing the creation of the upload resource
    console.log('Phase:', info.type);
    // Payload information depends on the type of notification
    console.log('Details:', info.payload);
  }
  async function run(element, index) {
    console.log(`processing ${element.title} at index ${index}`);
    const client = buildClient({ apiToken: datoCMSApiToken });
    // Create upload resource from a remote URL
    try {
      const response = await client.uploads.createFromUrl({
        // remote URL to upload
        // url: 'http://wp-stg.trademachines.com/en/wp-content/uploads/sites/2/2014/11/182x182.jpg',
        url: element.attachment_url,
        // if you want, you can specify a different base name for the uploaded file
        filename: element.title,
        // skip the upload and return an existing resource if it's already present in the Media Area:
        skipCreationIfAlreadyExists: false,
        // be notified about the progress of the operation.
        // onProgress: handleProgress,
        // specify some additional metadata to the upload resource
        default_field_metadata: {
          es: {
            alt: element.alt || element.title,
            title: element.title,
            custom_data: {
            },
          },
        },
      });
      // successfulUrls.push({...element, datoCMSUrl: response.url, response});
      successfulUrls.push({...element, datoCMSUrl: response.url, datoImageId: response.id});
      fs.appendFileSync('output/temp/es_successLogs.txt', `${JSON.stringify({...element, datoCMSUrl: response.url, datoImageId: response.id})},`);
      // if (response) {  console.log(response.path)}
      // fs.writeFileSync("output/temp_en_successLogs.json", successfulUrls, 'utf8' );
      console.log(successfulUrls.length + " uploaded successfully");
    } catch (error) {
      console.log("error found", error.message);
      errorUrls.push({ ...element, errorMessage: error.message});
      fs.appendFileSync('output/temp/es_errorLogs.txt', `${JSON.stringify({ ...element, errorMessage: error.message})},`);
      // fs.writeFileSync("output/temp_en_errorLogs.json", errorUrls, 'utf8' );
    }
  };

  async function destroyAllUploads() {
    const client = buildClient({ apiToken: datoCMSApiToken });
    for (let index = 0; index < 1000; index++) {
      const uploads = await client.uploads.list();
      if(uploads.length <= 1) return;
      const idList = uploads.map(upload => ({id: upload.id, type: "upload"}));
      await client.uploads.bulkDestroy({
        uploads: idList
      });
    }
  }

  const folders = ["category", "manufacturer", "product", "content", "auction_house"]
  const languages = ['en', 'de', 'es', 'fr', 'it', 'pl']


  // xml2jsonConverter("en");
  // mapJsonContent(data);


  // languages.forEach( language => xml2jsonConverter(language));
  // languages.forEach( language => mapJsonContent(language));


  // folders.forEach(folder => {
  //   languages.forEach(async language => await fetchFromElastic(folder, language))
  // });

  // fetchFromElastic("category", "es");
  // bulkMediaUploader();

  // console.log(updateDatoUrlInString(myString, successLogs));

  fs.readdir('./output/elasticData/en', (err, files) => {
    files.forEach(file => {
      let data = fs.readFileSync(`output/elasticData/en/${file}`);
      data = JSON.parse(data);
      const updatedData = data.map(record => {
        if(record.content) {
          const updatedString = updateDatoUrlInString(record.content, englishSuccessLogs);
          return {...record, content: updatedString}
        } else {
          return {...record}
        }
      });
      fs.writeFileSync(`output/elasticData/updated/en/${file}`, JSON.stringify(updatedData), 'utf8' );
    });
  });