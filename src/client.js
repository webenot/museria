const fs = require('fs');
const merge = require('lodash/merge');
const pick = require('lodash/pick');
const fetch = require('node-fetch');
const ClientStoracle = require('storacle/src/client')();
const utils = require('./utils');
const errors = require('./errors');

module.exports = (Parent) => {
  /**
   * Class to manage client requests to the network
   */
  return class ClientMuseria extends (Parent || ClientStoracle) {
    static get utils () { return utils }
    static get errors () { return errors }
    
    constructor(options = {}) {
      options = merge({
        request: {
          fileStoringTimeout: '11m',
          fileGettingTimeout: '5m'
        }
      }, options);

      super(options);
    }
    
    /**
     * Get the song full info list
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {string}
     */
    async getSongInfo(title, options = {}) {
      return (await this.request('get-song-info', {
        body: { title },
        timeout: options.timeout || this.options.request.fileLinkGettingTimeout,
        useInitialAddress: options.useInitialAddress
      })).info;
    }

    /**
     * Get the song merged info
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {string}
     */
    async getSong(title, options = {}) {
      const result = await this.request('get-song-info', {
        body: { title },
        timeout: options.timeout || this.options.request.fileLinkGettingTimeout,
        useInitialAddress: options.useInitialAddress
      });

      if(!result.info.length) {
        return null;
      }

      let obj = { tags: {} };

      for(let i = result.info.length - 1; i >= 0; i--) {
        const info = result.info[i];
        !info.coverLink && delete info.coverLink;
        const prevTags = !i? pick(Object.assign(obj.tags), utils.heritableSongTags): obj.tags;
        info.tags = Object.assign(prevTags, info.tags);        
        obj = Object.assign(obj, info);
      }

      return obj;
    }

    /**
     * Get the song audio link
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {object[]}
     */
    async getSongAudioLink(title, options = {}) {
      return (await this.request('get-song-link', {
        body: { title, type: 'audio' },
        timeout: options.timeout || this.options.request.fileLinkGettingTimeout,
        useInitialAddress: options.useInitialAddress
      })).link;
    }

    /**
     * Get the song cover link
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {string}
     */
    async getSongCoverLink(title, options = {}) {
      return (await this.request('get-song-link', {
        body: { title, type: 'cover' },
        timeout: options.timeout || this.options.request.fileLinkGettingTimeout,
        useInitialAddress: options.useInitialAddress
      })).link;
    }

    /**
     * Get the song to a buffer
     * 
     * @param {string} title
     * @param {string} type
     * @param {object} [options]
     * @returns {Buffer}
     */
    async getSongToBuffer(title, type, options = {}) {
      this.envTest(false, 'getSongToBuffer');
      const timeout = options.timeout || this.options.request.fileGettingTimeout;
      const timer = this.createRequestTimer(timeout);

      let result  = await this.request('get-song-link', {
        body: { title, type },
        timeout: timer([ this.options.request.fileLinkGettingTimeout ]),
        useInitialAddress: options.useInitialAddress
      });
      
      if(!result.link) {
        throw new errors.WorkError(`Link for song "${title}" is not found`, 'ERR_MUSERIA_NOT_FOUND_LINK');
      }
      
      return await new Promise(async (resolve, reject) => {
        try {
          const chunks = [];
          (await fetch(result.link, this.createDefaultRequestOptions({ method: 'GET', timeout: timer() }))).body
          .on('error', (err) => reject(utils.isRequestTimeoutError(err)? utils.createRequestTimeoutError(): err))  
          .on('data', chunk => chunks.push(chunk))
          .on('end', () => resolve(Buffer.concat(chunks)));
        }   
        catch(err) {
          reject(err);
        }  
      });
    }
    
    /**
     * Get the song audio to a buffer
     * 
     * @see ClientMuseria.prototype.getSongToBuffer
     */
    async getSongAudioToBuffer(title, options = {}) {
      return this.getSongToBuffer(title, 'audio', options);
    }

    /**
     * Get the song cover to a buffer
     * 
     * @see ClientMuseria.prototype.getSongToBuffer
     */
    async getSongCoverToBuffer(title, options = {}) {
      return this.getSongToBuffer(title, 'cover', options);
    }

    /**
     * Get the song to the path
     * 
     * @param {string} title
     * @param {string} filePath
     * @param {string} type
     * @param {object} [options]
     * @returns {Buffer}
     */
    async getSongToPath(title, filePath, type, options = {}) {
      this.envTest(false, 'getSongToBuffer');
      const timeout = options.timeout || this.options.request.fileGettingTimeout;
      const timer = this.createRequestTimer(timeout);

      let result  = await this.request('get-song-link', {
        body: { title, type },
        timeout: timer([ this.options.request.fileLinkGettingTimeout ]),
        useInitialAddress: options.useInitialAddress
      });
      
      if(!result.link) {
        throw new errors.WorkError(`Link for song "${title}" is not found`, 'ERR_MUSERIA_NOT_FOUND_LINK');
      }
      
      return await new Promise(async (resolve, reject) => {
        try { 
          (await fetch(result.link, this.createDefaultRequestOptions({ method: 'GET', timeout: timer() }))).body
          .on('error', (err) => reject(utils.isRequestTimeoutError(err)? utils.createRequestTimeoutError(): err))
          .pipe(fs.createWriteStream(filePath))
          .on('error', reject)
          .on('finish', resolve);
        }   
        catch(err) {
          reject(err);
        }  
      });
    }

    /**
     * Get the song audio to the path
     * 
     * @see ClientMuseria.prototype.getSongToPath
     */
    async getSongAudioToPath(title, filePath, options = {}) {
      return this.getSongToPath(title, filePath, 'audio', options);
    }

    /**
     * Get the song cover to the path
     * 
     * @see ClientMuseria.prototype.getSongToPath
     */
    async getSongCoverToPath(title, filePath, options = {}) {
      return this.getSongToPath(title, filePath,  'cover', options);
    }

    /**
     * Get the song to a blob
     * 
     * @param {string} title
     * @param {string} type
     * @param {object} [options]
     * @returns {Buffer}
     */
    async getSongToBlob(title, type, options = {}) {
      this.envTest(false, 'getSongToBuffer');
      const timeout = options.timeout || this.options.request.fileGettingTimeout;
      const timer = this.createRequestTimer(timeout);

      let result  = await this.request('get-song-link', {
        body: { title, type },
        timeout: timer([ this.options.request.fileLinkGettingTimeout ]),
        useInitialAddress: options.useInitialAddress
      });
      
      if(!result.link) {
        throw new errors.WorkError(`Link for song "${title}" is not found`, 'ERR_MUSERIA_NOT_FOUND_LINK');
      }
      
      result = await fetch(result.link, this.createDefaultRequestOptions({
        method: 'GET',
        timeout: timer()
      }));

      return result.blob();
    }

    /**
     * Get the song audio to a blob
     * 
     * @see ClientMuseria.prototype.getSongToBlob
     */
    async getSongAudioToBlob(title, options = {}) {
      return this.getSongToBlob(title, 'audio', options);
    }

    /**
     * Get the song cover to a blob
     * 
     * @see ClientMuseria.prototype.getSongToBlob
     */
    async getSongCoverToBlob(title, options = {}) {
      return this.getSongToBlob(title, 'cover', options);
    }

    /**
     * Store the file to the storage
     * 
     * @async
     * @param {string|Buffer|fs.ReadStream|Blob|File} file
     * @param {object} [options]
     */
    async addSong(file, options = {}) {
      const destroyFileStream = () => utils.isFileReadStream(file) && file.destroy();

      try {
        const info = await utils.getFileInfo(file);
        const tags = await utils.getSongTags(file);
        
        if(!utils.isSongTitle(tags.TIT2)) {
          throw new errors.WorkError(`Wrong song title "${tags.TIT2}"`, 'ERR_MUSERIA_SONG_WRONG_TITLE');
        }

        if(typeof file == 'string') {
          file = fs.createReadStream(file);
        }

        const result = await this.request('add-song', {
          formData: {
            file: {
              value: file,
              options: {
                filename: info.hash + (info.ext? '.' + info.ext: ''),
                contentType: info.mime
              }
            }
          },
          timeout: options.timeout || this.options.request.fileStoringTimeout,
          useInitialAddress: options.useInitialAddress
        });

        destroyFileStream();
        return result;
      }
      catch(err) {
        destroyFileStream();
        throw err;
      }
    }

    /**
     * Remove the song
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {object}
     */
    async removeSong(title, options = {}) {
      return await this.request('remove-song', {
        body: { title },
        timeout: options.timeout || this.options.request.fileRemovalTimeout,
        useInitialAddress: options.useInitialAddress
      });
    }

    /**
     * Create a deferred song link
     * 
     * @param {string} title 
     * @param {string} type 
     * @param {object} options 
     * @returns {string}
     */
    createRequestedSongLink(title, type, options = {}) {
      options = Object.assign({ 
        query: {
          type,
          title          
        }
      }, options);
      return this.createRequestUrl(`request-song`, options);
    }

    /**
     * Create a deferred song audio link
     * 
     * @see ClientMuseria.prototype.createRequestedSongLink
     */
    createRequestedSongAudioLink(title, options = {}) {
      return this.createRequestedSongLink(title, 'audio', options);
    }

    /**
     * Create a deferred song cover link
     * 
     * @see ClientMuseria.prototype.createRequestedSongLink
     */
    createRequestedSongCoverLink(title, options = {}) {
      return this.createRequestedSongLink(title, 'cover', options);
    }
  }
};