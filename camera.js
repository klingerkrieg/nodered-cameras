/**
 * Autores:Alan Klinger klingerkrieg@gmail.com
 * 		   Lucas Dantas lucashiagod@gmail.com
 * Plugin do node-red
 */
var hostsConfig;
var portsToScan;
var networksToNmap;
var useScan, useNmapScan, useCapture;
var captureInterval;
//vai salvar o server e ultimo scaneamento no context
var globalContext;

const fs = require('fs');
const scan = require('./scan');
const httpScan = require('./httpScan').httpScan;
const nmapScan = require('./nmapScan');
const nmapSync = nmapScan.nmapSync;
const filtrarVideos = nmapScan.filtrarVideos;

const exec = require('child_process');
const startCapture = require('./capture').startCapture;
const startStream = require('./stream').startStream;


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
		

		if (config.scanType == "none"){
			//Usar ou nao escaneamento de rede (desativa totalmente)
			useScan = false;
			useNmapScan = false;
		} else 
		if (config.scanType == "http"){
			globalContext.set("running",false);
			//o escaneamento http e mais rapido, porem nao encontra rtsp
			useScan = true;
			useNmapScan = false;
		} else 
		if (config.scanType == "nmap"){
			globalContext.set("running",false);
			useScan = true;
			//Opcao para usar o nmap, dessa forma encontra rtsp e http, porem mais lento
			useNmapScan = true;
		}

		useCapture = config.capture;
		globalContext.set("capturePath",config.capturePath);
		if (globalContext.get("capturePath").trim() == ""){
			globalContext.set("capturePath","./captures");
		}
		
		
        this.on('input', function(msg) {
			try {
				clearTimeout(captureInterval);

				//Aparentemente ele mantem as variaveis globais
				html = "";

				//verifica dependencias quanto ao nmap ou ffmpeg
				var deps = require('./dependencias');
				var dep = deps.check();
				msg.payload = "";
				checkFail = false;
				if (dep.nmap == false && useNmapScan){
					msg.payload += "Configure no path ou instale o nmap<br/>apt-get install nmap<br/>";
					checkFail = true;
				}
				if (dep.ffmpeg == false){
					html += "Aplicativos RTSP n&atilde;o est&atilde;o compat&iacute;veis e a captura n&atilde;o ";
					html += "poder&aacute; ser realizada.<br/>Configure no path ou instale o ffmpeg<br/><ul>";
					html += "<li>sudo add-apt-repository ppa:mc3man/trusty-media</li><li>sudo apt-get update</li>";
					html += "<li>sudo apt-get install ffmpeg gstreamer0.10-ffmpeg";
				}
				if (checkFail){
					node.send(msg);
				}
				
				networksToNmap = scan.getNetworks(networksToNmap);
				
				//caso o usuario opte por usar o nmap
				if (useScan){
					if (msg.req.query != undefined && msg.req.query.scan != undefined && msg.req.query.scan == 1 || globalContext.get("hosts") == undefined){
						

						context = {'globalContext':globalContext,
								'msg':msg,
								'node':node};

						if (useNmapScan){
							console.log(">>>>USE NMAP SCAN<<<<");
							data = nmapSync(networksToNmap,portsToScan);
							//A entrega do nmapSync e identica ao do node-nmap
							//Caso seja necessario voltar a utilizar o node-nmap
							//Basta passar o resultado para o nmapPadronizeList
							hosts = scan.nmapPadronizeList(data);
							
							hosts = scan.hostsConfigToHosts(hostsConfig,hosts);
							
							//startCapture e startStream sao chamados dentro de filtrarVideos
							filtrarVideos(hosts,scanCallBack,context);
							
						} else {
							console.log(">>>>USE HTTP SCAN<<<<");
							httpScan(networksToNmap,portsToScan,scanCallBack,context);
						}
						
					} else {
						console.log("Use last scan<<");
						hosts = globalContext.get("hosts");
						msg = startStream(hosts, msg, globalContext);
						node.send(msg);
					}
				} else {//caso opte por nao usar
					hosts = scan.hostsConfigToHosts(hostsConfig,[]);

					if (useCapture == true){
						startCapture(hosts, globalContext);
					}
					msg = startStream(hosts, msg, globalContext);
					node.send(msg);
				}
			} catch (error) {
				console.log("***Erro total***");
				console.log(error);
				msg.payload = "Falha, tente novamente.";
				node.send(msg);

			}
			
        });
    }
    RED.nodes.registerType("Camera All Configs",CameraNode);
}



function scanCallBack(hosts,context){
	hosts = scan.hostsConfigToHosts(hostsConfig,hosts);
	context.globalContext.set("hosts",hosts);
	//Quando o httpScan e utilizado nao ha necessidade de filtrar os host
	//ele ja retorna o resultado filtrado
	if (useCapture == true){
		startCapture(hosts, context.globalContext);
	}
	context.msg = startStream(hosts, context.msg, context.globalContext);
	context.node.send(context.msg);
}



