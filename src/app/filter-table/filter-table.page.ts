import { Component, OnInit } from '@angular/core';
import {
    LoadingController, AlertController, MenuController, ModalController, Platform
} from "@ionic/angular";
import { Router } from '@angular/router';
import { Validators, FormControl, FormGroup, FormBuilder } from '@angular/forms';

@Component({
    standalone: false,
    selector: 'app-filter-table',
    templateUrl: './filter-table.page.html',
    styleUrls: ['./filter-table.page.scss'],
})
export class FilterTablePage implements OnInit {

    minimumStake: string = "0.0";
    maximumStake: string = "100.000";
    simpleKora: boolean = true;
    doubleKora: boolean = false;
    tripleKora: boolean = false;
    debut: string = "10";

    constructor(
        private router: Router,
        private platform: Platform,
        private formBuilder: FormBuilder,
        private modalCtrl: ModalController,
        private menu: MenuController,
        private alertCtrl: AlertController,
        private loadingCtrl: LoadingController) { }

    ngOnInit() {
    }

    reset(){

    }
    
    filter(){

    }
    
    dismiss() {
        this.modalCtrl.dismiss({
            'dismissed': true
        });
    }
}
