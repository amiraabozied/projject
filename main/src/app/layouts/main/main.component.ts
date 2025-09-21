import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { HeaderComponent } from '../full/vertical/header/header.component';
import { SearchBoxComponent } from 'src/app/components/search-box/search-box.component';
import { AppHorizontalHeaderComponent } from "../full/horizontal/header/header.component";

@Component({
  selector: 'main-app',
  imports: [RouterOutlet, NavbarComponent, HeaderComponent, SearchBoxComponent, AppHorizontalHeaderComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {

}
