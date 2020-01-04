import './app.scss';
import Akili from 'akili';
import router from 'akili/src/services/router';
import client from '../../client';

export default class App extends Akili.Component {
  static template = require('./app.html');

  static define() {
    Akili.component('app', this);

    router.add('app', '^/app', {
      component: this,
      title: 'Museria - decentralized storage'     
    });
  }

  created() {  
    this.scope.searchInputFocus = true;
    this.scope.uploadFormFails = { cover: false, title: false };
    this.scope.findSong = this.findSong.bind(this);
    this.scope.chooseSong = this.chooseSong.bind(this);
    this.scope.prepareAudio = this.prepareAudio.bind(this); 
    this.scope.prepareCover = this.prepareCover.bind(this); 
    this.scope.removeCover = this.removeCover.bind(this);
    this.scope.uploadSong = this.uploadSong.bind(this); 
    this.scope.resetSearchEvent = this.resetSearchEvent.bind(this);
    this.scope.resetUploadEvent = this.resetUploadEvent.bind(this); 
    this.scope.checkUploadSongTitle = this.checkUploadSongTitle.bind(this);    
    this.resetSearchEvent();
    this.resetUploadEvent();
    this.resetSongUploadInfo();
  }

  resetSearchEvent() {
    this.scope.searchEvent = { status: '', message: '', meta: {} };
  }

  resetUploadEvent() {
    this.scope.uploadEvent = { status: '', message: '' };
  }

  resetSongUploadInfo() {
    this.scope.songUploadInfo = { title: '', сover: '', file: null, coverFile: null };
  }

  async findSong(title) {
    if(!title) {
      return;
    }

    try {
      const info = await client.getSong(title);       
      this.scope.searchEvent.status = 'info';     
      this.scope.searchEvent.message = 'No related songs found';    
  
      if(info) { 
        this.scope.searchEvent.status = 'success';
        this.scope.searchEvent.message = '';
        this.scope.searchEvent.meta = { title: info.title, link: info.audioLink };
      }
    }
    catch(err) {
      if(!err.code) {
        throw err;
      }

      this.scope.searchEvent.status = 'danger';
      this.scope.searchEvent.message = err.message;

      if(err.code == 'ERR_MUSERIA_SONG_WRONG_TITLE') {
        this.scope.searchEvent.message = 'Wrong song title. It must be like "Artist - Title"';
      }
    }     
  }

  chooseSong() {
    this.resetSongUploadInfo();
    this.el.querySelector('#audio-file').click();    
  }

  async prepareAudio(file) {
    if(!file) {
      return;
    }

    const tags = await client.constructor.utils.getSongTags(file);

    if(file.type != "audio/mpeg" && file.type != "audio/mp3") {
      this.scope.uploadEvent = { status: 'danger', message: 'File must be "mp3"' };
      return;
    }

    this.resetUploadEvent();
    this.scope.songUploadInfo = { file, title: tags.fullTitle };

    if(tags.APIC) {
      const coverFile = new Blob([tags.APIC]);
      this.scope.songUploadInfo.cover = await this.getCoverLink(coverFile);
      this.scope.songUploadInfo.coverFile = coverFile;
    }

    this.checkUploadSongTitle();
  }

  async prepareCover(file) {
    if(!file) {
      return;
    }

    if(file.type != "image/jpeg" && file.type != "image/png") {
      this.scope.uploadFormFails.cover = '';
      this.scope.songUploadInfo.cover = '';
      this.scope.songUploadInfo.coverFile = null;
      return;
    }    
    
    this.scope.songUploadInfo.coverFile = file;
    this.scope.songUploadInfo.cover = await this.getCoverLink(file);
  }

  async removeCover() {
    this.scope.uploadFormFails.cover = '';
    this.scope.songUploadInfo.cover = '';
    this.scope.songUploadInfo.coverFile = null;   
  }

  async getCoverLink(file) {
    return new Promise((resolve, reject) => {
      const fn = e => {
        reader.removeEventListener('loadend', fn);
        e.error? reject(e.error): resolve(e.target.result);  
      }

      const reader = new FileReader();
      reader.addEventListener('loadend', fn);
      reader.readAsDataURL(file);
    });   
  }

  checkUploadSongTitle() {
    this.scope.uploadFormFails.title = false;

    if(!client.constructor.utils.isSongTitle(this.scope.songUploadInfo.title)) {
      this.scope.uploadFormFails.title = true;
    }
  }

  async uploadSong() {
    const tags = await client.constructor.utils.getSongTags(this.scope.songUploadInfo.file);
    tags.fullTitle = this.scope.songUploadInfo.title;

    if(this.scope.songUploadInfo.coverFile) {
      tags.APIC = this.scope.songUploadInfo.coverFile;
    }
    else {
      delete tags.APIC;
    }

    const file = await client.constructor.utils.setSongTags(this.scope.songUploadInfo.file, tags); 

    try {
      await client.addSong(file);
      this.scope.uploadEvent.status = 'success';
      this.scope.uploadEvent.message = 'Song has been uploaded';
    }
    catch(err) {
      if(!err.code) {
        throw err;
      }

      this.scope.uploadEvent.status = 'danger';
      this.scope.uploadEvent.message = err.message;
    }

    this.resetSongUploadInfo();
    this.el.querySelector('#audio-file').value = '';
  }
}