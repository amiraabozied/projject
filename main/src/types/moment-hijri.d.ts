declare module 'moment-hijri' {
  interface MomentHijri {
    format(format?: string): string;
    locale(locale?: string): MomentHijri;
    toDate(): Date;
    iDate(): number;
    iMonth(): number;
    iYear(): number;
  }

  function moment(date?: any, format?: string): MomentHijri;

  export = moment;
}
