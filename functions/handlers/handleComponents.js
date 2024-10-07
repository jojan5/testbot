const { readdirSync } = require('fs');

module.exports = client => {
    client.handleComponents = async() => {
        const componentsFolder = readdirSync('./components')
        for(const folder of componentsFolder) {
            const componentsFiles = readdirSync('./components/'+folder).filter(
                (file) => file.endsWith('.js')
            );
            const {buttons} = client;
            switch(folder) {
                case "buttons":
                    for(const file of componentsFiles) {
                        const button = require('../../components/'+folder+'/'+file);
                        buttons.set(button.data.name, button);
                    }
                    break;
                default:
                    break;
            }
        }
    }
}