const fs = require('fs');
const axios = require('axios');
const convert = require('xml-js');

const jsdom = require("jsdom");
const { JSDOM } = jsdom
global.DOMParser = new JSDOM().window.DOMParser

const mapJsonContent = (language) => {

    let fullObject = fs.readFileSync(`exports/wordpressJson/${language}.json`);
    fullObject = JSON.parse(fullObject);

    const getAlt = (element) => {
        if(!element["wp:postmeta"] || element["wp:postmeta"].length < 1 || !Array.isArray(element["wp:postmeta"])) return element.title._text;
        const index = element["wp:postmeta"].findIndex(element => element["wp:meta_key"]._cdata === "_wp_attachment_image_alt");
        return index >= 0 ? element["wp:postmeta"][index]["wp:meta_value"]._cdata : element.title._text
    } 

    let jsonContent = fullObject.rss.channel.item.map(element => ({ title: element.title._text, link: element.link._text, guid: element.guid._text, post_id: element["wp:post_id"]._text, attachment_url: element["wp:attachment_url"]._cdata, alt: getAlt(element) }));

    jsonContent = JSON.stringify(jsonContent);

    fs.writeFile(`exports/wordpressMappedJson/${language}.json`, jsonContent, 'utf8', function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    }); 
} 


const fetchFromElastic = async (folder, locale, size=1000) => {

    let { data: response } = await axios.get(`http://mkp-frontend-es.prd.rz.t11s.de/tmfoxx/content/_search?q=folder:tm_${folder}%20AND%20locale:${locale}&size=${size}`);
    
    let mappedData = response.hits.hits.map(element => ({id: element._id, content: element._source.content}));

    if (response.hits.total > 1000) {
        for (let index = 1; index <= Math.floor(response.hits.total/1000); index++) {
            const { data: response } = await axios.get(`http://mkp-frontend-es.prd.rz.t11s.de/tmfoxx/content/_search?q=folder:tm_${folder}%20AND%20locale:${locale}&from=${index*1000}&size=${size}`);
            const requiredData = response.hits.hits.map(element => ({id: element._id, content: element._source.content}));
            mappedData = [...mappedData, ...requiredData];
        }
    };
    mappedData = JSON.stringify(mappedData);
    fs.writeFile(`output/elasticData/${folder}_${locale}.json`, mappedData, 'utf8', function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("elastic reponse file saved!");
      });
}


const updateDatoUrlInString  = function (str, successLogs) {

  let parser = new DOMParser();
  let doc = parser.parseFromString(str, 'text/html');
  const imagesArray = doc.body.querySelectorAll("img");
  const linkArray = doc.body.querySelectorAll("a");

  if (imagesArray && imagesArray.length >= 1) {
    imagesArray.forEach(image => {
        if (image.dataset && image.dataset.src && image.dataset.src.includes("sites/")) {
            let obj = successLogs.find(element => element.attachment_url.split("sites/")[1] === image.dataset.src.split("sites/")[1]);

            if(!obj) {
                obj = successLogs.find(element => image.dataset.src.split("sites/")[1].includes(element.attachment_url.split("sites/")[1].split(".")[0]) );
            }

            if(!obj) {
                obj = successLogs.find(element => image.dataset.src.split("sites/")[1].toLowerCase().includes(element.attachment_url.split("sites/")[1].split(".")[0].toLowerCase()) );
            }

            if(!obj) {
                obj = successLogs.find(element => element.attachment_url.split("sites/")[1].toLowerCase().includes(image.dataset.src.split("sites/")[1].toLowerCase().split(".")[0]) );
            }

            if (obj) {
                image.removeAttribute("data-src");
                image.src = obj.datoCMSUrl
            }
        };
        if (image.src && image.src.includes("sites/")) {
            let obj = successLogs.find(element => element.attachment_url.split("sites/")[1] === image.src.split("sites/")[1]);

            if(!obj) {
                obj = successLogs.find(element => image.src.split("sites/")[1].includes(element.attachment_url.split("sites/")[1].split(".")[0]) );
            }

            if(!obj) {
                obj = successLogs.find(element => image.src.split("sites/")[1].toLowerCase().includes(element.attachment_url.split("sites/")[1].split(".")[0].toLowerCase()) );
            }

            if(!obj) {
                obj = successLogs.find(element => element.attachment_url.split("sites/")[1].toLowerCase().includes(image.src.split("sites/")[1].toLowerCase().split(".")[0]) );
            }

            if (obj) {
                image.src = obj.datoCMSUrl
            }
        }
    })
  };

  if (linkArray && linkArray.length >= 1) {
    linkArray.forEach(link => {
        if (link.href && link.href.includes("sites/")) {
            let obj = successLogs.find(element => element.attachment_url.split("sites/")[1] === link.href.split("sites/")[1]);

            if(!obj) {
                obj = successLogs.find(element => link.href.split("sites/")[1].includes(element.attachment_url.split("sites/")[1].split(".")[0]) );
            }

            if(!obj) {
                obj = successLogs.find(element => link.href.split("sites/")[1].toLowerCase().includes(element.attachment_url.split("sites/")[1].toLowerCase().split(".")[0]) );
            }

            if(!obj) {
                obj = successLogs.find(element => element.attachment_url.split("sites/")[1].toLowerCase().includes(link.href.split("sites/")[1].toLowerCase().split(".")[0]) );
            }

            if (obj) {
                link.href = obj.datoCMSUrl;
                link.target = "_blank"
            }
        }
    })
  }

//   fs.writeFile("output/changedHtml.json", JSON.stringify(doc.body.innerHTML), 'utf8', function (err) {
//     if (err) {
//         return console.log(err);
//     }
//     console.log("html file saved!");
//   });

  return doc.body.innerHTML;
};


const xml2jsonConverter = (locale) => {
    const xml = fs.readFileSync(`exports/wordpressXML/${locale}.xml`, { encoding: 'utf8', flag: 'r' });
    
    const xmlData = convert.xml2json(xml, {
        compact: true,
        space: 3
    });

    fs.writeFile(`exports/wordpressJson/${locale}.json`, JSON.stringify(JSON.parse(xmlData)), 'utf8', function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("json file saved!");
    });

}

const grabNonXMLImages = (language) => {
    fs.readdir(`output/elasticData/updated/${language}`, (err, files) => {
        let imagesArray = [];
        files.forEach(file => {
          let data = fs.readFileSync(`output/elasticData/updated/${language}/${file}`);
          data = JSON.parse(data);
          data.forEach(record => {
            if(record.content) {
                let parser = new DOMParser();
                let doc = parser.parseFromString(record.content, 'text/html');
                const images = doc.body.querySelectorAll("img");
                const linkArray = doc.body.querySelectorAll("a");
                images.forEach(image => {
                    if (image.dataset && image.dataset.src && image.dataset.src.includes("assets/media/content/sites")) {
                        imagesArray = [...imagesArray, { folderName: file, src: image.dataset.src, alt: image.alt || null, extension: image.dataset.src.split(".")[1], type: "image", fileName: (() => { let imageName = image.dataset.src.split(".")[0].split("/"); imageName = imageName[imageName.length - 1]; return imageName })() }]
                    };
                    if (image.src && image.src.includes("assets/media/content/sites")) {
                        imagesArray = [...imagesArray, { folderName: file, src: image.src, alt: image.alt || null, extension: image.src.split(".")[1], type: "image", fileName:  (() => { let imageName = image.src.split(".")[0].split("/"); imageName = imageName[imageName.length - 1]; return imageName })()}]
                    }
                });
                if (linkArray && linkArray.length >= 1) {
                    linkArray.forEach(link => {
                        if (link.href && link.href.includes("assets/media/content/sites")) {
                            imagesArray = [...imagesArray, { folderName: file, src: link.href, type: "link", extension: link.href.split(".")[1], fileName:  (() => { let imageName = link.href.split(".")[0].split("/"); imageName = imageName[imageName.length - 1]; return imageName })() }]
                        }
                    })
                } 
            }
          });
        });
        fs.writeFileSync(`output/elasticData/updated/${language}/nonXML.json`, JSON.stringify(imagesArray), 'utf8' );
      });
}






module.exports = {
    mapJsonContent,
    fetchFromElastic,
    updateDatoUrlInString,
    xml2jsonConverter,
    grabNonXMLImages
}


