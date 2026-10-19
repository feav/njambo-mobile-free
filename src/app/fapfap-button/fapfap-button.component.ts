import { Component, OnInit, Input, HostBinding } from '@angular/core';

@Component({
    standalone: false,
    selector: 'fapfap-button',
    templateUrl: './fapfap-button.component.html',
    styleUrls: ['./fapfap-button.component.scss'],
})
export class FapfapButtonComponent implements OnInit {

    @Input() label?: string = "Okay";
    @HostBinding("style.--background") @Input() background?: string = "success";
    @HostBinding("style.--background-shade") backgroundShade: string;
    @HostBinding("style.--background-tint") backgroundTint: string;
    @HostBinding("style.--color") @Input() color?: string = "#FFF";
    @HostBinding("style.width") get widthStyle(): string | undefined {
        return this._width;
    }
    @Input() set width(value: string | undefined) {
        this._width = value;
    }
    @HostBinding("style.--height") @Input() height?: string = "46px";
    private _width?: string;

    constructor() { }

    ngOnInit() {
        if(this.background == "tertiary"){
            this.background = "#fa9917";
            this.backgroundShade = "#e18a15";
            this.backgroundTint = "#fbad45";
        }else if(this.background == "danger"){
            this.background = "#ff5f58";
            this.backgroundShade = "#e6564f";
            this.backgroundTint = "#ff7f79";
        }else{
            this.background = "#2ac940";
            this.backgroundShade = "#26b53a";
            this.backgroundTint = "#6ad979";
        }
    }

}
