import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
const today = new Date();
const month = today.getMonth();
const year = today.getFullYear();
@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [FormsModule, CommonModule , MatFormFieldModule, MatDatepickerModule, FormsModule, ReactiveFormsModule],
    providers: [provideNativeDateAdapter()],

  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent {
  rooms: any[] = [
    { adults: 2, children: 0, childAges: [], bedType: 'Double' }
  ];

  // 👇 متغير فتح/قفل الفلتر
  showRoomFilter = false;

  // 👇 الدالة اللي ناديت عليها في الـ HTML
  toggleRoomFilter() {
    this.showRoomFilter = !this.showRoomFilter;
  }

  addRoom() {
    this.rooms.push({ adults: 1, children: 0, childAges: [], bedType: 'Single' });
  }

  removeRoom(index: number) {
    if (this.rooms.length > 1) {
      this.rooms.splice(index, 1);
    }
  }

  changeValue(room: any, field: 'adults' | 'children', delta: number) {
    if (room[field] + delta >= 0) {
      room[field] += delta;
      if (field === 'children') {
        if (room.children > room.childAges.length) {
          room.childAges.push(0);
        } else {
          room.childAges.splice(room.children);
        }
      }
    }
  }

  get summary(): string {
    return this.rooms
      .map((room, i) => {
        return `Room ${i + 1}: ${room.adults} Adults, ${room.children} Children` 
              
      })
      .join(' | ');
  }

  apply() {
    console.log(this.rooms);
  }

    readonly campaignOne = new FormGroup({
    start: new FormControl(new Date(year, month, 13)),
    end: new FormControl(new Date(year, month, 16)),
  });
  readonly campaignTwo = new FormGroup({
    start: new FormControl(new Date(year, month, 15)),
    end: new FormControl(new Date(year, month, 19)),
  });
}
