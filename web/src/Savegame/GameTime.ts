import type { Language } from "../Engine/Language.ts";

export enum TimeTrigger {
  TIME_5SEC,
  TIME_10MIN,
  TIME_30MIN,
  TIME_1HOUR,
  TIME_1DAY,
  TIME_1MONTH
}

export class GameTime {
  constructor(
    private _weekday = 6,
    private _day = 1,
    private _month = 1,
    private _year = 1999,
    private _hour = 12,
    private _minute = 0,
    private _second = 0
  ) {}

  clone(): GameTime {
    return new GameTime(this._weekday, this._day, this._month, this._year, this._hour, this._minute, this._second);
  }

  getSecond(): number {
    return this._second;
  }

  getMinute(): number {
    return this._minute;
  }

  getHour(): number {
    return this._hour;
  }

  getWeekday(): number {
    return this._weekday;
  }

  getWeekdayString(): string {
    return ["STR_SUNDAY", "STR_MONDAY", "STR_TUESDAY", "STR_WEDNESDAY", "STR_THURSDAY", "STR_FRIDAY", "STR_SATURDAY"][this._weekday - 1] || "STR_SUNDAY";
  }

  getDay(): number {
    return this._day;
  }

  getDayString(lang: Language): string {
    let stringId = "STR_DATE_FOURTH";
    if (this._day === 1 || this._day === 21 || this._day === 31) {
      stringId = "STR_DATE_FIRST";
    } else if (this._day === 2 || this._day === 22) {
      stringId = "STR_DATE_SECOND";
    } else if (this._day === 3 || this._day === 23) {
      stringId = "STR_DATE_THIRD";
    }
    return String(lang.getString(stringId).arg(this._day));
  }

  getMonth(): number {
    return this._month;
  }

  getMonthString(): string {
    return ["STR_JAN", "STR_FEB", "STR_MAR", "STR_APR", "STR_MAY", "STR_JUN", "STR_JUL", "STR_AUG", "STR_SEP", "STR_OCT", "STR_NOV", "STR_DEC"][this._month - 1] || "STR_JAN";
  }

  getYear(): number {
    return this._year;
  }

  advance(): TimeTrigger {
    let trigger = TimeTrigger.TIME_5SEC;
    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if ((this._year % 4 === 0) && !(this._year % 100 === 0 && this._year % 400 !== 0)) {
      monthDays[1]++;
    }

    this._second += 5;
    if (this._second >= 60) {
      this._minute++;
      this._second = 0;
      if (this._minute % 10 === 0) {
        trigger = TimeTrigger.TIME_10MIN;
      }
      if (this._minute % 30 === 0) {
        trigger = TimeTrigger.TIME_30MIN;
      }
    }
    if (this._minute >= 60) {
      this._hour++;
      this._minute = 0;
      trigger = TimeTrigger.TIME_1HOUR;
    }
    if (this._hour >= 24) {
      this._day++;
      this._weekday++;
      this._hour = 0;
      trigger = TimeTrigger.TIME_1DAY;
    }
    if (this._weekday > 7) {
      this._weekday = 1;
    }
    if (this._day > monthDays[this._month - 1]) {
      this._day = 1;
      this._month++;
      trigger = TimeTrigger.TIME_1MONTH;
    }
    if (this._month > 12) {
      this._month = 1;
      this._year++;
    }
    return trigger;
  }
}
