import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './hero.component.html',
  styleUrls: ['./hero.component.scss']
})
export class HeroComponent {
  rooms: any[] = [
    { adults: 2, children: 0, childAges: [], bedType: '' }
  ];

  showRoomFilter = false; // 👈 علشان تتحكم في الظهور

  toggleRoomFilter() {
    this.showRoomFilter = !this.showRoomFilter;
  }

  addRoom() {
    this.rooms.push({ adults: 1, children: 0, childAges: [], bedType: '' });
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
        // sync child ages
        if (room.children > room.childAges.length) {
          room.childAges.push(0);
        } else {
          room.childAges.splice(room.children);
        }
      }
    }
  }

  get summary(): string {
    return this.rooms.map((room, i) => {
      return `Room ${i + 1}: ${room.adults} Adults, ${room.children} Children` +
             (room.bedType ? `, Bed: ${room.bedType}` : '');
    }).join(' | ');
  }

  apply() {
    console.log(this.rooms);
    this.showRoomFilter = false; // يقفل الفلتر بعد التطبيق
  }
}
