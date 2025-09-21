import { Component, ViewEncapsulation } from '@angular/core';
import { MaterialModule } from '../../material.module';
import { SearchBoxComponent } from '../../components/search-box/search-box.component';

@Component({
    selector: 'app-starter',
    imports: [MaterialModule, SearchBoxComponent],
    templateUrl: './starter.component.html',
    encapsulation: ViewEncapsulation.None
})
export class StarterComponent {
  onSearchFormSubmit(searchData: any): void {
    console.log('Search Form Data:', searchData);
    // Here you would typically call a service to perform the search
    alert('Search form submitted! Check console for details.');
  }
}
