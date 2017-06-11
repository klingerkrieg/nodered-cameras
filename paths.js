//paths da url onde as cameras operam
module.exports = {
  getPaths: function(){
      return ['/video','/image/jpeg.cgi','/mjpeg',"/live.jpeg","/screen_stream.mjpeg","/videofeed","/mjpegfeed?640x480","/cam/1/frame.jpg"];
  }
};