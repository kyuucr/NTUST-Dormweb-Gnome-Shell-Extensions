
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const AppName = 'NTUST Quota Indicator';
const NormalIcon = 'system-run-symbolic';
const ErrorIcon = 'dialog-error-symbolic';

const QuotaMenuItem = new Lang.Class({
    Name: 'QuotaMenu.QuotaMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (text, params) {
        this.parent(params);

        this._baseLabel = text + ": ";
        this._naLabel = "N/A";
        this.label = new St.Label({ text: "" });
        this.actor.add_child(this.label);
        this.actor.label_actor = this.label;
        this.setLabelNA();
    },

    setLabelValue: function(value) {
        this.label.set_text(this._baseLabel + value);
    },

    setLabelNA: function() {
        this.label.set_text(this._baseLabel + this._naLabel);
    },

});

const QuotaButton = new Lang.Class({
    Name: 'QuotaMenu.QuotaButton',
    Extends: PanelMenu.Button,

    _init: function(metadata, params) {
        this.parent(0.0, AppName);
        this.actor.accessible_role = Atk.Role.TOGGLE_BUTTON;

        this._icon = new St.Icon({
            icon_name: NormalIcon,
            style_class: 'system-status-icon'
        });
        this.actor.add_actor(this._icon);
        this.actor.add_style_class_name('panel-status-button');

        this.menu.addMenuItem(new QuotaMenuItem("IP", { reactive: false, activate: false, hover: false }));
        this.menu.addMenuItem(new QuotaMenuItem("Total", { reactive: false, activate: false, hover: false }));
        this.menu.addMenuItem(new QuotaMenuItem("Upload", { reactive: false, activate: false, hover: false }));
        this.menu.addMenuItem(new QuotaMenuItem("Download", { reactive: false, activate: false, hover: false }));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let parent = this;
        this.menu.addAction("Update now", function(event) {
            parent.update(false);
        });
    
        this.update(true);
    },
  
    update: function(recurse) {
        let client = new Gio.SocketClient({ protocol: Gio.SocketProtocol.TCP });
        let connection = null, addr = null, quota = new Array();
        try {
            // Try to connect to netweb through URI
            connection = client.connect_to_uri("http://netweb.ntust.edu.tw", 80, null);
      
            // Get and set the IP address
            addr = connection.get_local_address().get_address().to_string();
            this.menu._getMenuItems()[0].setLabelValue(addr);
      
            // Send POST here
            let outputStream = connection.get_output_stream();
            let now = new Date();
            let inputBody = {
                ip: addr,
                hip: /^[0-9]+\.[0-9]+\./.exec(addr),
                date: now.getFullYear() + '%2F' + this._pad(now.getMonth() + 1) + '%2F' + this._pad(now.getDate())
            };
            let postBody = this.PostBody.format(inputBody.date, inputBody.ip, inputBody.hip, inputBody.ip, inputBody.date);
            let postHeader = this.PostHeader.format(postBody.length);
            // global.log("postHeader: " + postHeader);
            // global.log("postBody: " + postBody);
            outputStream.write(postHeader + postBody, null);
      
            // Read response here
            let inputStream = new Gio.DataInputStream({ base_stream: connection.get_input_stream() });
            let line, count = 0;
            do {
                line = inputStream.read_line(null);
                // global.log("replyLine: " + line);
                if(/id="tablelist__ctl3_tid[1-3]"/.test(line)) {
                    quota.push(parseFloat(/[0-9,]{3,}/.exec(line)[0].replace(/,/gi, "")));
                    global.log("NTUST QUOTA " + count + ": " + quota[count]);
                    count++;
                } else if (/<\/html>/i.test(line)) {
                    throw "EOF";
                }
            } while (count < 3);
            connection.close(null);
            this.menu._getMenuItems()[1].setLabelValue((Math.round(quota[0] / 10000) / 100) + " MB");
            this.menu._getMenuItems()[2].setLabelValue((Math.round(quota[1] / 10000) / 100) + " MB");
            this.menu._getMenuItems()[3].setLabelValue((Math.round(quota[2] / 10000) / 100) + " MB");
            if (quota[0] > 2500000000) {
                Main.notify("Dormweb quota warning!", "Your quota has reached 2500 MB");
                this._icon.icon_name = ErrorIcon;
            } else this._icon.icon_name = NormalIcon;

        } catch (ex) {
            global.log("NTUST ERR: " + ex);
            this._icon.icon_name = ErrorIcon;
            if (connection !== null)
                connection.close(null);
            if (addr === null)
                this.menu._getMenuItems()[0].setLabelNA();
            if (quota.length < 3) {
                this.menu._getMenuItems()[1].setLabelNA();
                this.menu._getMenuItems()[2].setLabelNA();
                this.menu._getMenuItems()[3].setLabelNA();
            }
        }
        global.log("NTUST UPDATED: " + new Date());
        if (recurse) {
            this._timeoutS = Mainloop.timeout_add_seconds(300, Lang.bind(this, function() {
                this.update(true);
            }));
        }
    },
  
    _pad : function(n) { return n < 10 ? '0' + n : n; },
  
    PostHeader: 'POST /dormweb/flowquery.aspx HTTP/1.1\r\n' +
    'Host: netweb.ntust.edu.tw\r\n' +
    'Connection: keep-alive\r\n' +
    'Content-Length: %s\r\n' +
    'Cache-Control: max-age=0\r\n' +
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n' +
    'Origin: http://netweb.ntust.edu.tw\r\n' +
    'User-Agent: Mozilla/5.0 (compatible; NTUST Dormweb checker/0.2; https://github.com/kyuucr/NTUST-Dormweb-Gnome-Shell-Extensions/)\r\n' +
    'Content-Type: application/x-www-form-urlencoded\r\n' +
    'Referer: http://netweb.ntust.edu.tw/dormweb/flowquery.aspx\r\n' +
    'Accept-Encoding: gzip,deflate,sdch\r\n' +
    'Accept-Language: en-US,en;q=0.8,id;q=0.6\r\n' +
    'Cookie: ASP.NET_SessionId=jrhjt545okx02f55uslixr55\r\n\r\n',
  
    PostBody: '__EVENTTARGET=ipdata&__EVENTARGUMENT=&__VIEWSTATE=dDwtNDY0NjA5NTM4O3Q8O2w8aTwyPjs%%2BO2w8dDw7bDxpPDE%%2BO2k8Mz47aTw1PjtpPDc%%2BO2k8MTM%%2BOz47bDx0PDtsPGk8MT47aTw3PjtpPDk%%2BOz47bDx0PHA8cDxsPFRleHQ7PjtsPOWci%%2Beri%%2BWPsOeBo%%2BenkeaKgOWkp%%2BWtuCDlsI3lpJbntrLot6%%2FmtYHph4%%2Fmn6XoqaIo5qCh5YWn57ay6Lev5bCI55SoKTs%%2BPjs%%2BOzs%%2BO3Q8cDxwPGw8VGV4dDs%%2BO2w855m75YWl5pel5pyf77yaMjAxNC8wMy8yODs%%2BPjs%%2BOzs%%2BO3Q8O2w8aTwwPjs%%2BO2w8dDw7bDxpPDE%%2BO2k8Mj47PjtsPHQ8O2w8aTwwPjs%%2BO2w8dDx0PDs7bDxpPDA%%2BOz4%%2BOzs%%2BOz4%%2BO3Q8O2w8aTwxPjs%%2BO2w8dDx0PHA8cDxsPERhdGFUZXh0RmllbGQ7PjtsPFN0cmluZ1RleHQ7Pj47Pjt0PGk8ND47QDxCeXRlcztLQjtNQjtHQjs%%2BO0A8Qnl0ZXM7S0I7TUI7R0I7Pj47Pjs7Pjs%%2BPjs%%2BPjs%%2BPjs%%2BPjt0PDtsPGk8Nz47PjtsPHQ8cDxwPGw8VGV4dDs%%2BO2w8XGU7Pj47Pjs7Pjs%%2BPjt0PHA8cDxsPFRleHQ7PjtsPFw8YnJcPuazqOaEj%%2B%%2B8muWboOe1seioiOWfuua6luS4jeWQjO%%2B8jOiri%%2BWLv%%2BiIh%%2BWAi%%2BS6uumbu%%2BiFpuavlOi8g%%2B%%2B8jOWmguacieWVj%%2BmhjOiri21haWzliLAgY2Nwb3N0bWFuQG1haWwubnR1c3QuZWR1LnR3IOiojuirluOAgjs%%2BPjs%%2BOzs%%2BO3Q8cDxwPGw8VmlzaWJsZTs%%2BO2w8bzxmPjs%%2BPjs%%2BO2w8aTwxPjtpPDM%%2BOz47bDx0PHA8cDxsPFRleHQ7PjtsPOips%%2Be0sOa1gemHj%%2Bafpeipojs%%2BPjs%%2BOzs%%2BO3Q8QDA8cDxwPGw8UGFnZVNpemU7PjtsPGk8MzI3NjA%%2BOz4%%2BOz47Ozs7Ozs7Ozs7Pjs7Pjs%%2BPjt0PHA8cDxsPFZpc2libGU7PjtsPG88Zj47Pj47PjtsPGk8MT47aTw1PjtpPDc%%2BO2k8OT47PjtsPHQ8cDxwPGw8VGV4dDs%%2BO2w8Kjs%%2BPjs%%2BOzs%%2BO3Q8cDxwPGw8VGV4dDs%%2BO2w8XGU7Pj47Pjs7Pjt0PHA8cDxsPFRleHQ7PjtsPDA7Pj47Pjs7Pjt0PHA8cDxsPFRleHQ7PjtsPFxlOz4%%2BOz47Oz47Pj47Pj47Pj47PjWOIK06sfz2utthGVxiENPZeg6Z&RB_1=%%E8%%A9%%B3%%E7%%B4%%B0%%E6%%B5%%81%%E9%%87%%8F%%E6%%9F%%A5%%E8%%A9%%A2&un=Bytes&do_date=%s&ipdata=%s&Bbase=%%E6%%9F%%A5%%E8%%A9%%A2&hip=%s&msg_sysadm=%%EF%%BC%%8C%%E8%%AB%%8B%%E6%%92%%A5%%E5%%88%%86%%E6%%A9%%9F6212%%E6%%B4%%BD%%E7%%AE%%A1%%E7%%90%%86%%E8%%80%%85%%EF%%BC%%81&p_ip=%s&dorm=&pdate=%s&page_size=32760&sel_str=dodate%%3D%%27*****%%27&tablename=ipflowtable&tot_columns=4&tot_rows=0&tinsert=&hmaxlen=10%%2C14%%2C14%%2C14%%2C13%%2C10%%2C13%%2C6%%2C6%%2C13%%2C20%%2C15%%2C15%%2C15%%2C15&od_str=&un_v=1',
  
    destroy: function() {
        this.parent();
    },
});

function init() {
}

let _indicator;

function enable() {
    _indicator = new QuotaButton();
    Main.panel.addToStatusArea('QuotaMenu.QuotaButton', _indicator);
}

function disable() {
    _indicator.destroy();
}
