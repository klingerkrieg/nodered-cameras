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
//vai salvar o server e ultimo scaneamento no context
var globalContext;
//paths da url onde as cameras operam
var paths = ['/video','/image/jpeg.cgi','/mjpeg',"/live.jpeg","/screen_stream.mjpeg","/videofeed","/mjpegfeed?640x480","/cam/1/frame.jpg"];

const fs = require('fs');
const scan = require('./scan');
const httpScan = require('./httpScan').httpScan;
const exec = require('child_process');

module.exports = function(RED) {
    function CameraNode(config) {
        RED.nodes.createNode(this,config);
        node = this;

		globalContext = node.context().global;


		//Carrega as configuuracoes
		portsToScan = config.searchPorts;
		if (portsToScan == undefined || portsToScan == ""){
			portsToScan = '80,8080,8081,4747';
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
			
			//Opcao para usar ou nao o nmap (caso desative usa o scan do http que aparentemente esta mais rapido, mas precisa de testes)
			useNmapScan = true;
			//Usar ou nao escaneamento de rede (desativa totalmente)
			useScan = true;

			//caso o usuario opte por usar o nmap
			if (useScan){
				if (msg.req.query != undefined && msg.req.query.scan != undefined && msg.req.query.scan == 1 || globalContext.get("hosts") == undefined){

					if (useNmapScan){
						console.log(">>>>USE NMAP SCAN<<<<");
						hosts = scan.scan(portsToScan,paths,networksToNmap);
						hosts = scan.hostsConfigToHosts(hostsConfig,hosts);
						globalContext.set("hosts",hosts);

						//startCapture e startStream sao chamados dentro de filtrarVideos
						hosts = filtrarVideos(hosts);
						
					} else {
						console.log(">>>>USE HTTP SCAN<<<<");
						httpScan(networksToNmap,portsToScan,paths,scanCallBack);
					}
					
				} else {
					console.log("Use last scan<<");
					hosts = globalContext.get("hosts");
					startStream(hosts);
				}
			} else {//caso opte por nao usar
				hosts = scan.hostsConfigToHosts(hostsConfig,[]);

				startCapture(hosts);
				startStream(hosts);
			}
			
			
        });
    }
    RED.nodes.registerType("camera",CameraNode);
}

function scanCallBack(hosts){
	hosts = scan.hostsConfigToHosts(hostsConfig,hosts);
	globalContext.set("hosts",hosts);
	//Quando o httpScan e utilizado nao ha necessidade de filtrar os host
	//ele ja retorna o resultado filtrado
	startCapture(hosts);
	startStream(hosts);
}



function startCapture(hosts){
	
	//Captura
	//cria pasta
	if (!fs.existsSync("./captures")){
		fs.mkdirSync("./captures");
	}
	//Cria processos para salvar as cameras
	var totalSaved = hosts.length;
	setInterval(function(){
		//Controle para só salvar o proximo frame se todos os anteriores tiverem sido salvos
		//Para evitar muitos processos no server
		if (totalSaved < hosts.length){
			return;
		}
		totalSaved = 0;
		for (var i = 0; i < hosts.length; i++){
			host = hosts[i];
			
			path = "captures/"+host.ip.replace(/\./g, '_')+"/";
			if (!fs.existsSync(path)){
				fs.mkdirSync(path);
			}
			url = host.protocol+"://"+host.ip+":"+host.port+host.path
			//salvar todas as cameras possiveis
			var dt = new Date();
			path += "/"+ dt.toISOString().split(".")[0].replace(/[:]/g,"-")
			cmd = "ffmpeg -i "+url+" -vframes 1 -updatefirst 1 "+path+ ".jpg -y";
			exec.exec(cmd, function(error, stdout, stderr) {
				totalSaved++;
			});
		}
		//verificar se esta conseguindo salvar, se nao conseguir mais ele deve parar de tentar
	},3000);
}


/**
 * Inicia o stream de videos
 */
function startStream(hosts){
	
	
	/*hosts = [{ip:'192.168.0.11',
			port:8080,
			path:"/mjpeg",
			type:"mjpeg",
			protocol:"http"}]*/

	console.log("Hosts encontrados...");
	console.log(hosts);


	//Adiciona um codigo ao video para substituir o ip na url
	streamCode = 1;
	for (var i = 0; i < hosts.length; i++){
		hosts[i].urlCode = streamCode++;

		//Para os formatos RTSP cria-se um arquivo jpg que sera servido via http
		if (hosts[i].protocol == 'rtsp'){
			var host = hosts[i];
			var url = host.protocol+"://"+host.ip+":"+host.port+host.path;
			var cmd = "ffmpeg -i "+url+" -f image2 -updatefirst 1 ./captures/stream-"+host.urlCode+".jpg -y";
			console.log(cmd);
			exec.exec(cmd);
		}
	}

	
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
				
				
				if (host.protocol == 'rtsp'){
					var file = "./captures/stream-"+host.urlCode+".jpg";
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
			html += '<embed class='+autoUpdate+' type="application/x-vlc-plugin" pluginspage="http://www.videolan.org" autoplay="yes" loop="no" width="300" height="200" target="http://'+urlToServer+':'+portForStream+'/'+reqUrl+'" />'
				 +'<object classid="clsid:9BE31822-FDAD-461B-AD51-BE1D1C159921" codebase="http://download.videolan.org/pub/videolan/vlc/last/win32/axvlc.cab" style="display:none;"></object>';
		} else {
			//para todos os outros streams sera usado o padrao jpg
			html += '<img class="'+autoUpdate+'" src="http://'+urlToServer+':'+portForStream+'/'+reqUrl+'">';
		}
		
	}
	//Script para atualizar as cameras que sao do tipo jpeg sem stream
	html += "<script>function updateImage() {imgs = document.getElementsByClassName('update');for (var _i = 0; _i < imgs.length; _i++){imgs[_i].src = imgs[_i].src.split('?')[0] + '?t='+ new Date().getTime();console.log(imgs[_i].src);}} setInterval(updateImage, 1000);</script>";
	
	msg.payload = html;
	msg.refresh = "<a href='?scan=1'>refresh</a>";
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

		if (host.protocol == 'rtsp'){
			//caso ele esteja no protocolo rtsp nao sera filtrado
			hosts_filtrados.push(host);
			completes += paths.length;//Soma para sair da espera
			continue;
		}
		
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
				//console.log("Got error: " + e.message);
			});
		}
	}
	
	
	//Espera as urls serem testadas
	var interval = setInterval(function(){
		console.log("Testando videos...");
		if (completes == (hosts.length * paths.length)){
			clearInterval(interval);
			console.log("iniciando captura.");
			startCapture(hosts_filtrados);
			console.log("iniciando stream.");
			//só começa a realizar o stream quando testar todos os hosts
			startStream(hosts_filtrados,node,msg);
		}
	}, 500);
	
	
}

