
module.exports = {
  nmapSync: function (ips,ports) {
    return nmapSync(ips,ports);
  },

  nmapAsync: function(ips,ports,call) {
    nmapAsync(ips,ports,call);
  }
}


function nmapSync(ips,ports,call){
    const exec = require('child_process');
    
    nmapCmd = "nmap "+ips+" -p "+ports;
    var obj = exec.execSync(nmapCmd);
    stdout = obj.toString();
    
    return readResponse(stdout);
}

function nmapAsync(ips,ports,call){
    const exec = require('child_process');
    
    nmapCmd = "nmap "+ips+" -p "+ports;
    var cmd = exec.exec(nmapCmd, function(error, stdout, stderr) {
        readResponse(stdout);

        call(data);
    });
}


function readResponse(){
    //Removo a primeira linha
    stdout = stdout.trim()
    stdout = stdout.trim().substr(stdout.indexOf("\n")).trim();
    //Separo por hosts
    var hosts = stdout.split("\n\n");
    //Descarto a ultima linha

    var data = [];
    var ipv4 = /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/i
    var portOpen = /[0-9]{1,8}\/tcp[\s]{1,5}open/ig
    for (var i = 0; i < hosts.length-1; i++){

        var ip = ipv4.exec(hosts[i])[0];
        var ports = []
        do {
            open = portOpen.exec(hosts[i]);
            if (open != null){
                ports.push({"port":open[0].split("/")[0]});
            }
        } while(open);

        //adaptacao para funcionar igual ao implementado anteriormente
        if (ports.length == 0){
            ports = null;
        }
        
        data.push({'ip':ip,'openPorts':ports});
    }
    return data;
}


/*
var ips = "10.0.0.0/24";
var ports = "80,8080,8081";



nmap(ips,ports,function(data){
    console.log(data);
});*/