/**
 * Autores:Alan Klinger klingerkrieg@gmail.com
 * 		   Lucas Dantas lucashiagod@gmail.com
 * Plugin do node-red
 */
var hostsConfig;
var portsToScan;
var networksToNmap;
var urlToServer;
var portForStream = 1337;
var portForRTSP = 1338;
var node;
var msg;
//paths da url onde as cameras operam
var paths = ['/video','/image/jpeg.cgi','/mjpeg',"/live.jpeg"];

var fs = require('fs');
var scan = require('./scan');


module.exports = function(RED) {
    function CameraNode(config) {
        RED.nodes.createNode(this,config);
        node = this;

		//Carrega as configuuracoes
		portsToScan = config.searchPorts;
		if (portsToScan == undefined || portsToScan == ""){
			portsToScan = '80,8080,8081';
		}
		networksToNmap = config.networksToNmap;
		
		hostsConfig = config.hosts.split("\n");
		var nmapConfig = config.nmap;
		
        this.on('input', function(msgParam) {
			//salva o obj msg
			msg = msgParam;

			//salva o caminho da url para acesso do server
			urlToServer = msg.req.headers.host.split(":")[0];

			//verifica dependencias quanto ao nmap ou ffmpeg
			var deps = require('./dependencias');
			var dep = deps.check();
			msgParam.payload = "";
			checkFail = false;
			if (dep.nmap == false && nmapConfig){
				msgParam.payload += "Configure no path ou instale o nmap<br/>apt-get install nmap<br/>";
				checkFail = true;
			}
			if (dep.ffmpeg == false){
				msgParam.payload += "Configure no path ou instale o ffmpeg<br/><ul><li>sudo add-apt-repository ppa:mc3man/trusty-media</li><li>sudo apt-get update</li><li>sudo apt-get install ffmpeg gstreamer0.10-ffmpeg";
				checkFail = true;
			}
			if (checkFail){
				node.send(msgParam);
			}

			//caso o usuario opte por usar o nmap
			if (nmapConfig){
				hosts = scan.scan(portsToScan,paths,networksToNmap);
				filtrarVideos(hosts);
			} else {//caso opte por nao usar
				startStream([]);
			}
			
			
        });
    }
    RED.nodes.registerType("camera",CameraNode);
}



/**
 * Inicia o stream de videos
 */
function startStream(hosts){
	hosts = scan.hostsConfigToHosts(hostsConfig,hosts);
	
	/*hosts = [{ip:'192.168.0.11',
			port:8080,
			path:"/mjpeg",
			type:"mjpeg",
			protocol:"http"}]*/

	console.log("Hosts encontrados...");
	console.log(hosts);
	
	var request = require('request');
	var http = require('http');
	

	//vai salvar o server no context
	var globalContext = node.context().global;

	//caso ja tenha algum server aberto ele fecha
	if (globalContext.get("server") != undefined){
		globalContext.get("server").close();
		console.log("Server off");
	}

	const exec = require('child_process');

	//Captura
	var frame = 0;
	setInterval(function(){
		//criar pasta de captura
		//salvar todas as cameras possiveis
		cmd = "ffmpeg -i http://10.0.0.106:8080/video -vframes 1 -updatefirst 1 captures/img"+frame+".jpg -y";
		exec.exec(cmd);
		frame++;
		//verificar se esta conseguindo salvar, se nao conseguir mais ele deve parar de tentar
	},2000);
	
	
	//abre um novo server
	server = http.createServer(function (req, resp) {
		
		for (var i = 0; i < hosts.length; i++){
			host = hosts[i];

			
			
			url = host.protocol+"://"+host.ip+":"+host.port+host.path
			//Removo os parametros, para poder refazer a requisicao de imagens
			//Para cameras que nao trabalham com stream

			//console.log("req:"+ req.url +" - host:"+ '/'+host.ip.replace(/\./g, '_'));
			reqUrl = req.url.split("?");
			reqUrl = reqUrl[0];

			if (reqUrl === '/'+host.ip.replace(/\./g, '_')) {
				console.log(url);
				
				var x = request(url);
				//Se tivesse como conseguir o cabecalho aqui seria ideal
				//Mas o request nao retorna o cabecalho completo
				req.pipe(x);
				x.pipe(resp);
				
			}
			
		}
	});

	//escuta a porta
	server.listen(portForStream);
	//guarda no context
	globalContext.set("server",server);
	console.log("listen "+portForStream+" server on");
	
	

	html = '<style>.video{ width:320px;height:320px;border:1px solid;margin:5px; }</style>';
	for (var i = 0; i < hosts.length; i++){
		host = hosts[i];
		reqUrl = host.ip.replace(/\./g, '_');
		//Videos que foram definidos na configuracao nao sao testados
		//Todos esses serao do tipo update, melhorar isso depois porque posso ter um que nao necessite ser update
		if (host.type == 'jpeg' || host.type == null){
			autoUpdate = 'video update';
		} else {
			autoUpdate = 'video';
		}
		//quando é via plugin do vlc
		if (host.type == 'mpegurl' || host.protocol == 'rtsp'){
			if (host.protocol == 'rtsp'){
				
				//console.log("matando")
				//mata todos os processos do vlc
				/*var cmd = exec('Taskkill /IM vlc.exe /F', function(error, stdout, stderr) {
					console.log("ok");
					//cria o processo do vlc
					cmd = 'vlc -I rc -I http rtsp://184.72.239.149/vod/mp4:BigBuckBunny_115k.mov :sout=#transcode{vcodec=h264,scale=acodec=mpga,ab=128,channels=2,samplerate=44100}:http{mux=ffmpeg{mux=flv},dst=:'+portForRTSP+'/'+reqUrl+'} :sout-keep'
					console.log(cmd)
					cmd = exec(cmd);
				});*/

				list = exec.execSync('tasklist');
				if (list.indexOf('vlc') > -1){
					exec.execSync('taskkill /IM vlc.exe /F');
				}
				cmd = 'vlc -I rc -I http rtsp://184.72.239.149/vod/mp4:BigBuckBunny_115k.mov :sout=#transcode{vcodec=h264,scale=acodec=mpga,ab=128,channels=2,samplerate=44100}:http{mux=ffmpeg{mux=flv},dst=:'+portForRTSP+'/'+reqUrl+'} :sout-keep'
				console.log(cmd)
				cmd = exec.exec(cmd);
				
				port = portForRTSP;
			} else {
				port = portForStream;
			}
			html += '<embed class='+autoUpdate+' type="application/x-vlc-plugin" pluginspage="http://www.videolan.org" autoplay="yes" loop="no" width="300" height="200" target="http://'+urlToServer+':'+port+'/'+reqUrl+'" />'
				 +'<object classid="clsid:9BE31822-FDAD-461B-AD51-BE1D1C159921" codebase="http://download.videolan.org/pub/videolan/vlc/last/win32/axvlc.cab" style="display:none;"></object>';
		} else {
			//quando é streaming com png
			html += '<img class="'+autoUpdate+'" src="http://'+urlToServer+':'+portForStream+'/'+reqUrl+'">';
		}
		
	}
	//Script para atualizar as cameras que sao do tipo jpeg sem stream
	html += "<script>function updateImage() {imgs = document.getElementsByClassName('update');for (var _i = 0; _i < imgs.length; _i++){imgs[_i].src = imgs[_i].src.split('?')[0] + '?t='+ new Date().getTime();console.log(imgs[_i].src);}} setInterval(updateImage, 1000);</script>";
	
	msg.payload = html;
	node.send(msg);
	
	
}

/**
 * Verifica para cada host se ele possui alguma url com video
 */
function filtrarVideos(hosts){
	var hosts_filtrados = [];
	
	var completes = 0;
	var httpTest = require('http');
	for (var i = 0; i < hosts.length; i++){
		host = hosts[i];
		
		for (var y = 0; y < paths.length; y++){
		
			var options = {
				host: host.ip,
				port: host.port,
				path: paths[y],
				timeout: 1000
			};

			httpTest.get(options, function(resp){
				
				console.log("Test:"+resp.req._headers.host+resp.req.path+" - "+resp.statusCode);
				
				if (resp.statusCode == 200){
					
					host_part = resp.req._headers.host.split(":");
					if (host_part[1] == undefined){//quando é na porta 80 ele nao coloca porta nenhuma
						host_part[1] = 80;
					}
					if (scan.hostExistsIn(host_part[0],hosts_filtrados) == false){
						
						hosts_filtrados.push({ip:host_part[0],
											  port:host_part[1],
											  path:resp.req.path,
											  type:resp.headers['content-type'].split('/')[1],
											  protocol:"http"});
					}
					
				}
				completes++;
				this.abort();
				
			}).on("error", function(e,resp){
				completes++;
				console.log("Got error: " + e.message);
			});
		}
	}
	
	
	var interval = setInterval(function(){
		console.log("Testando videos...");
		if (completes == (hosts.length * paths.length)){
			clearInterval(interval);
			console.log("iniciando stream");
			//só começa a realizar o stream quando testar todos os hosts
			startStream(hosts_filtrados,node,msg);
		}
	}, 500);
	
	
}

