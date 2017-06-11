/**
 * Autores:Alan Klinger klingerkrieg@gmail.com
 * 		   Lucas Dantas lucashiagod@gmail.com
 * Plugin do node-red
 */
var hostsConfig;
var portsToScan;
var networksToNmap;

const scan = require('./scan');
const nmapScan = require('./nmapScan');
const nmapSync = nmapScan.nmapSync;
const filtrarVideos = nmapScan.filtrarVideos;

module.exports = function(RED) {
    function CameraScannerNmapNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

		var globalContext = node.context().global;


		//Carrega as configuuracoes
		portsToScan = config.searchPorts;
		if (portsToScan == undefined || portsToScan == ""){
			portsToScan = '80,8080,8081,4747';
		}
		networksToNmap = config.networksToNmap;
		
		hostsConfig = config.hosts.split("\n");
		

        this.on('input', function(msg) {
			try {
				networksToNmap = scan.getNetworks(networksToNmap);
	
				//caso o usuario opte por usar o nmap
				if (msg.req.query != undefined && msg.req.query.scan != undefined && msg.req.query.scan == 1 || globalContext.get("hosts") == undefined){
					globalContext.set("running",false);
					console.log(">>>>USE NMAP SCAN<<<<");
					data = nmapSync(networksToNmap,portsToScan);
					//A entrega do nmapSync e identica ao do node-nmap
					//Caso seja necessario voltar a utilizar o node-nmap
					//Basta passar o resultado para o nmapPadronizeList
					hosts = scan.nmapPadronizeList(data);
					
					hosts = scan.hostsConfigToHosts(hostsConfig,hosts);
					
					//startCapture e startStream sao chamados dentro de filtrarVideos
					context = {'globalContext':globalContext,
											'msg':msg,
											'node':node};
					filtrarVideos(hosts,scanCallBack,context);
					
				} else {
					console.log("Use last scan<<");
					msg.hosts = globalContext.get("hosts");
					node.send(msg);
				}
			} catch (error) {
				console.log("***Erro total ScannerNMAP***");
				console.log(error);
				msg.payload = "Falha, tente novamente.";
				node.send(msg);
			}
			
        });
    }
    RED.nodes.registerType("Cam NMAP Scanner",CameraScannerNmapNode);
}



function scanCallBack(hosts,context){
	hosts = scan.hostsConfigToHosts(hostsConfig,hosts);
	context.globalContext.set("hosts",hosts);
	context.msg.hosts = hosts;
	//envia para o proximo node
	context.node.send(context.msg);
}