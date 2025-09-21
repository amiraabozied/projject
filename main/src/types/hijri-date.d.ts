declare module 'hijri-date' {
  export class HijriDate {
    constructor(date?: Date | string | number);
    getDate(): number;
    getMonth(): number;
    getFullYear(): number;
    toGregorian(): Date;
    static fromGregorian(date: Date): HijriDate;
  }
}
