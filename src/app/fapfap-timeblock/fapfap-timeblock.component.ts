import { Component, OnInit, Input, HostBinding } from '@angular/core';

@Component({
    standalone: false,
    selector: 'fapfap-timeblock',
    templateUrl: './fapfap-timeblock.component.html',
    styleUrls: ['./fapfap-timeblock.component.scss'],
})
export class FapfapTimeblockComponent implements OnInit {

    gold: string = "linear-gradient(181.19deg, #f7c839 0%, #fff7c2 22%, #ecc34d 44%, #fbe573 66%, #e6ab00 100%, #fff 100%)";
    green: string = "linear-gradient(181.19deg, #39f746 0%, #d9ffc2 22%, #50ec4d 44%, #a3fb73 66%, #a5f970 100%, #e6ab00 100%, #fff 100%)";
    pink: string = "linear-gradient(181.19deg, #f739ab 0%, #ffc2e3 22%, #ec4d95 44%, #fb73c5 66%, #df2c90 97%, #e6ab00 100%, #fff 100%)";
    blue: string = "linear-gradient(181.19deg, #39d5f7 0%, #c2faff 22%, #4dd9ec 44%, #73ebfb 66%, #79e8ee 100%, #e6ab00 100%, #fff 100%)";

    @Input() secondsRemaining?: number = 19;
    @Input() totalSeconds?: number = 19;
    @HostBinding("style.--filling-color") @Input() fillingColor?: string;
    @HostBinding("style.--filling-level") get fillingLevel(): string {
        const total = Math.max(1, this.totalSeconds || 1);
        const remaining = Math.max(0, this.secondsRemaining ?? total);
        const percent = Math.max(0, Math.min(100, (remaining / total) * 100));
        return `${percent}%`;
    }

    get displaySeconds(): string {
        const remaining = Math.max(0, this.secondsRemaining ?? 0);
        return `${remaining}s`;
    }

    constructor() {}

    ngOnInit() {
        if(this.fillingColor == "gold")
            this.fillingColor = this.gold;
        else if(this.fillingColor == "green")
            this.fillingColor = this.green;
        else if(this.fillingColor == "pink")
            this.fillingColor = this.pink;
        else if(this.fillingColor == "blue")
            this.fillingColor = this.blue;
        else
            this.fillingColor = this.green;
    }

}
