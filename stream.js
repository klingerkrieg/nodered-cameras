var rtspInterval;
var urlToServer;
var portForStream = 1337;
var portForRTSP = 1338;

/**
 * Inicia o stream de videos
 */
function startStream(hosts, msg, globalContext){
	
	console.log("Hosts encontrados...");
	console.log(hosts);

	capturePath = globalContext.get("capturePath");

	//salva o caminho da url para acesso do server
	urlToServer = msg.req.headers.host.split(":")[0];

	//Adiciona um codigo ao video para substituir o ip na url
	streamCode = 1;
	for (var i = 0; i < hosts.length; i++){
		hosts[i].urlCode = streamCode++;
	}

	clearInterval(rtspInterval);
	rtspInterval = setInterval(function(){
		for (var i = 0; i < hosts.length; i++){
			//Para os formatos RTSP cria-se um arquivo jpg que sera servido via http
			if (hosts[i].protocol == 'rtsp'){
				var host = hosts[i];
				var url = host.protocol+"://"+host.ip+":"+host.port+host.path;
				var cmd = "ffmpeg -i "+url+" -f image2 -vframes 1 "+capturePath+"/stream-"+host.urlCode+".jpg -y";
				console.log(cmd);
				exec.exec(cmd);
			}
		}
	},2000);

	
	var request = require('request');
	var http = require('http');
	

	//caso ja tenha algum server aberto ele fecha
	if (globalContext.get("server") != undefined){
		globalContext.get("server").close();
		console.log("Server off");
	}


	
	//abre um novo server
	server = http.createServer(function (req, resp) {
		
		
		for (var i = 0; i < hosts.length; i++){
			host = hosts[i];

			url = host.protocol+"://"+host.ip+":"+host.port+host.path
			//Removo os parametros, para poder refazer a requisicao de imagens
			//Para cameras que nao trabalham com stream

			
			reqUrl = req.url.split("?");
			reqUrl = reqUrl[0];
			//console.log("req:"+ reqUrl +" - host:"+ host.urlCode);
			if (reqUrl === '/'+host.urlCode){
				globalContext.set("running", new Date().getTime() );
				try {
					if (host.protocol == 'rtsp'){
						var file = capturePath+"/stream-"+host.urlCode+".jpg";
						console.log(file);
						//Serve o arquivo capturado de rtsp
						fs.readFile(file, function (err, data) {
							resp.end(data);
						});
					} else {
						console.log(url);
						//Serve diretamente as imagens das cameras
						var x = request(url);
						req.pipe(x);
						x.pipe(resp);
					}	
				} catch (error) {
					resp.write("");
					resp.end();
				}
				
				
			}
			
		}
	});

	//escuta a porta
	server.listen(portForStream);
	//guarda no context
	globalContext.set("server",server);
	console.log("listen "+portForStream+" server on");
	
	
	var html = '<style>.boxVideo{display:inline-block;} .video{ width:320px;height:320px;border:1px solid;margin:5px; background-image:url("./icons/cameraoff.png"); background-size:320px; }</style>';
	for (var i = 0; i < hosts.length; i++){
		
		host = hosts[i];
		reqUrl = host.urlCode;
		//Videos que foram definidos na configuracao nao sao testados
		//Todos esses serao do tipo update, melhorar isso depois porque posso ter um que nao necessite ser update
		if (host.type == 'jpeg' || host.type == null || host.protocol == 'rtsp'){
			autoUpdate = 'video update';
		} else {
			autoUpdate = 'video';
		}
		


		//quando é via plugin do vlc
		if (host.type == 'mpegurl'){
			//app RTSP Camera que serve rtsp em http apresenta deficiencias
			//nao foi possivel utilizar o ffmpeg com ele devido ao formato m3u
			//e possivel servir com o http.createServer basta escrever esse objeto
			//o usuario precisa ter o plugin do vlc, firefox v49.0 vlc 2.2.2 
			html += '<div class="boxVideo"><embed class='+autoUpdate+' type="application/x-vlc-plugin" pluginspage="http://www.videolan.org" autoplay="yes" loop="no" width="300" height="200" target="http://'+urlToServer+':'+portForStream+'/'+reqUrl+'" />'
				 +'<object classid="clsid:9BE31822-FDAD-461B-AD51-BE1D1C159921" codebase="http://download.videolan.org/pub/videolan/vlc/last/win32/axvlc.cab" style="display:none;"></object>';
		} else {
			//para todos os outros streams sera usado o padrao jpg
			html += '<div class="boxVideo"><img class="'+autoUpdate+'" src="http://'+urlToServer+':'+portForStream+'/'+reqUrl+'">';
		}
		html += "<br/>"+host.ip+" <a target='_blank' download='"+ new Date().getTime() +".jpg' href=http://"+urlToServer+":"+portForStream+"/"+reqUrl+">Download</a></div>";
	}
	//Script para atualizar as cameras que sao do tipo jpeg sem stream
	html += "<script>function updateImage() {imgs = document.getElementsByClassName('update');for (var _i = 0; _i < imgs.length; _i++){imgs[_i].src = imgs[_i].src.split('?')[0] + '?t='+ new Date().getTime();console.log(imgs[_i].src);}} setInterval(updateImage, 1000);</script>";
	
	msg.payload = html;
	msg.refresh = "<a href='?scan=1'>refresh</a>";
	
	return msg;
}

module.exports = {
  startStream: startStream
};