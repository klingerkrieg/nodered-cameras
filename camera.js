/**
 * Autores:Alan Klinger klingerkrieg@gmail.com
 * 		   Lucas Dantas lulucadantas@gmail.com
 * Plugin do node-red
 */
var hosts_config;
var ports_to_scan;

module.exports = function(RED) {
    function CameraNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
		var global_msg;
		
		ports_to_scan = config.search_ports;
		if (ports_to_scan == ""){
			ports_to_scan = '80,8080,8081';
		}

		hosts_config = config.hosts.split("\n");
		var nmap_config = config.nmap;
		
        this.on('input', function(msg) {
			
			var fs = require('fs');
			
			paths = ['/video','/image/jpeg.cgi','/mjpeg'];
			//caso o usuario opte por usar o nmap
			if (nmap_config){
				scan(ports_to_scan,paths,node,msg);
			} else {
				getStream([],node,msg);
			}
			
			
        });
    }
    RED.nodes.registerType("camera",CameraNode);
}

/**
 * Mescla os hosts encontrados com os que estão configurados
 */
function hostsConfigToHosts(hostConfig,hosts){
	//separa um endereço compelto em partes dentro de um json
	//http://192.168.0.2:80/video
	
	for (var i = 0; i < hostConfig.length; i++){
		//se nao houver nenhuma url configurada
		if (hostConfig[i] == ""){
			continue;
		}
		parts = hostConfig[i].split("://")
		protocol = parts[0];
		
		if (parts[1].indexOf("/") == -1){
			host = parts[1];
			urlPath = "";
		} else {
			host = parts[1].substr(0,parts[1].indexOf("/"))
			urlPath = parts[1].substr(parts[1].indexOf("/"))
		}
		
		host = host.split(":")
		if (host.length > 1){//se houver porta
			port = host[1];
			host = host[0];
		} else {
			port = 80;//caso seja porta padrao
			host = host[0];
		}
		
		hosts.push({ip:host,
					port:port,
					path:urlPath,
					type:null,
					protocol:protocol});
	}
	return hosts;
}

/**
 * Inicia o stream de videos
 */
function getStream(hosts,node,msg){
	hosts = hostsConfigToHosts(hosts_config,hosts);
	
	//hosts = [{ip:'192.168.0.14',port:'8080'},{ip:'192.168.0.12',port:'8081'},{ip:'192.168.0.23',port:'8080'}];
	//hosts = [{ip:'192.168.0.14',port:'80'}]
	//hosts
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
		globalContext.get("server").shutdown(function() {
			console.log('Reset server 1337.');
		});
	}
	
	//abre um novo server
	server = http.createServer(function (req, resp) {
		
		for (var i = 0; i < hosts.length; i++){
			host = hosts[i];
			
			url = host.protocol+"://"+host.ip+":"+host.port+host.path;
			console.log(url);
			if (req.url === '/'+host.ip.replace(/\./g, '_')) {
				var x = request(url);
				req.pipe(x);
				x.pipe(resp);
			}
		}
	});

	server = require('http-shutdown')(server);
	//escuta a porta
	server.listen(1337);
	//guarda no context
	globalContext.set("server",server);
	console.log('listen 1337');
	

	html = '<style>.video{ width:320px;height:320px;border:1px solid;margin:5px; }</style>';
	for (var i = 0; i < hosts.length; i++){
		host = hosts[i];
		if (host.type == 'jpeg'){
			autoUpdate = 'video update';
		} else {
			autoUpdate = 'video';
		}
		//quando é via plugin do vlc
		if (host.type == 'mpegurl' || host.protocol == 'rtsp'){
			html += '<embed class='+autoUpdate+' type="application/x-vlc-plugin" pluginspage="http://www.videolan.org" autoplay="yes" loop="no" width="300" height="200" target="http://localhost:1337/'+host.ip.replace(/\./g, '_')+'" />'
				 +'<object classid="clsid:9BE31822-FDAD-461B-AD51-BE1D1C159921" codebase="http://download.videolan.org/pub/videolan/vlc/last/win32/axvlc.cab" style="display:none;"></object>';
		} else {
			//quando é streaming com png
			html += '<img class="'+autoUpdate+'" src="http://localhost:1337/'+host.ip.replace(/\./g, '_')+'">';
		}
		
	}

	/*html += 'function updateImage() { '
    		+' if(newImage.complete) { '
            +' newImage.src = document.getElementById("img").src; '
            +' var temp = newImage.src; '
            +' document.getElementById("img").src = newImage.src; '
            +' newImage = new Image(); ' 
            +' newImage.src = temp+"?" + new Date().getTime();'
			+' } '
			+' setTimeout(updateImage, 1000);'*/
	
	msg.payload = html;
	node.send(msg);
	
	
}

/**
 * Verifica para cada host se ele possui alguma url com video
 */
function filtrarVideos(hosts,paths,node,msg){
	
	var hosts_filtrados = [];
	
	var completes = 0;
	var httpTest = require('http');
	for (var i = 0; i < hosts.length; i++){
		host = hosts[i];
		
		for (var y = 0; y < paths.length; y++){
		
			var options = {
			host: host.ip,
			port: host.port,
			//path: '/video',
			//path: '/image/jpeg.cgi',
			path: paths[y],
			timeout: 1000
			};

			httpTest.get(options, function(resp){
				console.log("Test:"+resp.req._headers.host+resp.req.path+" - "+resp.statusCode);
				
				if (resp.statusCode == 200){
					console.log(resp.headers);
					host_part = resp.req._headers.host.split(":");
					if (host_part[1] == undefined){//quando é na porta 80 ele nao coloca porta nenhuma
						host_part[1] = 80;
					}
					if (hostExistsIn(host_part[0],hosts_filtrados) == false){
						
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
			getStream(hosts_filtrados,node,msg);
		}
	}, 500);
	
	
}





/**
 * Procura hosts na rede com o nmap
 */
function scan(portas,paths,node,msg){
	var nmap = require('node-nmap');
	var hosts = [];
	
	var nmapscan = new nmap.nodenmap.NmapScan ('192.168.0.0/24','-p '+ports_to_scan);
 
	nmapscan.on('complete', function(data){
		for(var i = 0; i < data.length; i++){
		  
		  if (data[i].openPorts != null){
			  
			  for(var y = 0; y < data[i].openPorts.length; y++){
				
				if (data[i].openPorts[y] != undefined){
					hosts.push({'ip':data[i].ip, 'port':data[i].openPorts[y].port});
				}
			  }
		  }
		  
		}
		
		hosts = filtrarVideos(hosts,paths,node,msg);
		
	});
	 
	nmapscan.on('error', function(error){
	  console.log(error);
	});
	nmapscan.startScan();
	
}

/**
 * Verifica se o host já está na lista
 */
function hostExistsIn(search,list){
	for (var i = 0; i < list.length; i++){
		if (list[i].ip == search){
			return true;
		}
	}
	return false;
}