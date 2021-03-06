const _ = require('lodash');
const utils = require('../../../../../utils');

/**
 * Get the song info
 */
module.exports.getSongInfo = node => {
  return async (req, res, next) => {
    try {
      const title = req.body.title;
      node.songTitleTest(title);
      let tags = {};
      let priority = 0;
      let audioLink = '';
      let coverLink = '';
      let name = ''
      const existent = await node.db.getMusicByPk(title);

      if(existent && existent.fileHash && await node.hasFile(existent.fileHash)) {
        await node.db.accessDocument(existent);
        priority = existent.priority || 0;
        audioLink = await node.createSongAudioLink(existent);
        coverLink = await node.createSongCoverLink(existent);
        tags = _.omit(await utils.getSongTags(node.getFilePath(existent.fileHash)), ['APIC']);
        name = existent.title;
      }

      return res.send({ tags, title: name, audioLink, coverLink, priority });
    }
    catch(err) {
      next(err);
    }   
  } 
};

/**
 * Remove the song
 */
module.exports.removeSong = node => {
  return async (req, res, next) => {
    try {
      const title = req.body.title;
      node.songTitleTest(title);      
      const existent = await node.db.getMusicByPk(title);
      let removed = false;

      if(existent && existent.fileHash && await node.hasFile(existent.fileHash)) {
        await node.removeFileFromStorage(existent.fileHash);
        removed = true;
      }

      res.send({ removed: +removed });
    }
    catch(err) {
      next(err);
    } 
  }   
};