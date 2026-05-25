export abstract class LanguagePlurality {
  abstract getSuffix(n: number): string;

  static create(language: string): LanguagePlurality {
    const creator = factoryFunctions.get(language) || OneSingular.create;
    return creator();
  }
}

export class OneSingular extends LanguagePlurality {
  static create(): LanguagePlurality {
    return new OneSingular();
  }

  getSuffix(n: number): string {
    return n === 1 ? "_one" : "_other";
  }
}

export class ZeroOneSingular extends LanguagePlurality {
  static create(): LanguagePlurality {
    return new ZeroOneSingular();
  }

  getSuffix(n: number): string {
    return n === 0 || n === 1 ? "_one" : "_other";
  }
}

export class NoSingular extends LanguagePlurality {
  static create(): LanguagePlurality {
    return new NoSingular();
  }

  getSuffix(_n: number): string {
    return "_other";
  }
}

export class CyrillicPlurality extends LanguagePlurality {
  static create(): LanguagePlurality {
    return new CyrillicPlurality();
  }

  getSuffix(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) {
      return "_one";
    }
    if ((n % 10 >= 2 && n % 10 <= 4) && !(n % 100 >= 12 && n % 100 <= 14)) {
      return "_few";
    }
    if (n % 10 === 0 || (n % 10 >= 5 && n % 10 <= 9) || (n % 100 >= 11 && n % 100 <= 14)) {
      return "_many";
    }
    return "_other";
  }
}

export class CzechPlurality extends LanguagePlurality {
  static create(): LanguagePlurality {
    return new CzechPlurality();
  }

  getSuffix(n: number): string {
    if (n === 1) {
      return "_one";
    }
    if (n >= 2 && n <= 4) {
      return "_few";
    }
    return "_other";
  }
}

export class PolishPlurality extends LanguagePlurality {
  static create(): LanguagePlurality {
    return new PolishPlurality();
  }

  getSuffix(n: number): string {
    if (n === 1) {
      return "_one";
    }
    if ((n % 10 >= 2 && n % 10 <= 4) && !(n % 100 >= 12 && n % 100 <= 14)) {
      return "_few";
    }
    if ((n % 10 <= 1) || (n % 10 >= 5 && n % 10 <= 9) || (n % 100 >= 12 && n % 100 <= 14)) {
      return "_many";
    }
    return "_other";
  }
}

export class RomanianPlurality extends LanguagePlurality {
  static create(): LanguagePlurality {
    return new RomanianPlurality();
  }

  getSuffix(n: number): string {
    if (n === 1) {
      return "_one";
    }
    if (n === 0 || (n % 100 >= 1 && n % 100 <= 19)) {
      return "_few";
    }
    return "_other";
  }
}

export class CroatianPlurality extends LanguagePlurality {
  static create(): LanguagePlurality {
    return new CroatianPlurality();
  }

  getSuffix(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) {
      return "_one";
    }
    if ((n % 10 >= 2 && n % 10 <= 4) && !(n % 100 >= 12 && n % 100 <= 14)) {
      return "_few";
    }
    return "_other";
  }
}

const factoryFunctions = new Map<string, () => LanguagePlurality>([
  ["fr", ZeroOneSingular.create],
  ["fr-CA", ZeroOneSingular.create],
  ["hu", NoSingular.create],
  ["tr", NoSingular.create],
  ["cs", CzechPlurality.create],
  ["pl", PolishPlurality.create],
  ["ro", RomanianPlurality.create],
  ["ru", CyrillicPlurality.create],
  ["sk", CzechPlurality.create],
  ["uk", CyrillicPlurality.create],
  ["ja", NoSingular.create],
  ["ko", NoSingular.create],
  ["zh-CN", NoSingular.create],
  ["zh-TW", NoSingular.create],
  ["hr", CroatianPlurality.create]
]);
