/**
 * Autores:Alan Klinger klingerkrieg@gmail.com
 * 		   Lucas Dantas lucashiagod@gmail.com
 * Plugin do node-red
 */
var hostsConfig;
var portsToScan;
var networksToNmap;

const scan = require('./scan');
const httpScan = require('./httpScan').httpScan;


module.exports = function(RED) {
    function CameraScannerHttpNode(config) {
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
					console.log(">>>>USE HTTP SCAN<<<<");
					//Cria context, essas variaveis devem ser passadas dessa forma
					//Porque ele nao consegue separar variavel global em cada fluxo
					context = {'globalContext':globalContext,
								'msg':msg,
								'node':node};
					httpScan(networksToNmap,portsToScan,scanCallBack,context);
					
				} else {
					console.log("Use last scan<<");
					msg.hosts = globalContext.get("hosts");
					node.send(msg);
				}
			} catch (error) {
				console.log("***Erro total em scannerHTTP***");
				console.log(error);
				msgParam.payload = "Falha, tente novamente.";
				node.send(msgParam);
			}
			
        });
    }
    RED.nodes.registerType("Cam HTTP Scanner",CameraScannerHttpNode);
}

function scanCallBack(hosts,context){
	hosts = scan.hostsConfigToHosts(hostsConfig,hosts);
	context.globalContext.set("hosts",hosts);
	context.msg.hosts = hosts;
	//envia para o proximo node
	context.node.send(context.msg);
}
