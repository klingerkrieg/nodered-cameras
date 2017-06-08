
//funcoes de ip
var ipv4 = require('./ipv4');

/**
 * Procura hosts na rede com o nmap
 */
function getNetworks(networksToNmap){
	
	var ips = "";

	if (networksToNmap == undefined || networksToNmap == ""){
		//Vasculha todas as interfaces de internet
		var os = require('os');
		var ifaces = os.networkInterfaces();	
		Object.keys(ifaces).forEach(function (ifname) {
			var alias = 0;
			
			//desconsidera essas interfaces
			if (ifname.toLowerCase().indexOf("loopback") > -1 || ifname.toLowerCase().indexOf("tunneling") > -1 ){
				return;
			}
			
			ifaces[ifname].forEach(function (iface) {
				//Somente as que sejam ipv4
				if ('IPv4' !== iface.family || iface.internal !== false) {
					return;
				}

				if (alias >= 1) {
					// this single interface has multiple ipv4 addresses
					//console.log(ifname + ':' + alias, iface.address);
				} else {
                    
					// this interface has only one ipv4 adress
					cidr = ipv4.subnetToCIDR(iface.netmask);
					ips += ipv4.getIpRangeNetMask(iface.address+"/"+cidr)[0]+"/"+cidr+" ";
				}
				++alias;
			});
		});
	} else {
		//Usa as redes configuradas
		ips = networksToNmap;
	}
	console.log("["+ips+"]");

	return ips;
}


function nmapPadronizeList(data){
	var hosts = [];
	for(var i = 0; i < data.length; i++){
		
		if (data[i].openPorts != null){
			
			for(var y = 0; y < data[i].openPorts.length; y++){
				if (data[i].openPorts[y] != undefined){
					hosts.push({'ip':data[i].ip, 'port':data[i].openPorts[y].port});
				}
			}
		}
		
	}
	
	return hosts;
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
		try {
			
			parts = hostConfig[i].split("://")
			protocol = parts[0];
			console.log(parts[1]);
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

		} catch (error) {
			console.log(error);
			console.log("***existe um erro nessa url***");
			console.log(hostConfig[i]);
		}
	}
	return hosts;
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


module.exports = {
  getNetworks: getNetworks,

  nmapPadronizeList: nmapPadronizeList,

  hostsConfigToHosts: hostsConfigToHosts,

  hostExistsIn: hostExistsIn
}