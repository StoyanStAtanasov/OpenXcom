export enum UfopaediaTypeId {
  UFOPAEDIA_TYPE_UNKNOWN = 0,
  UFOPAEDIA_TYPE_CRAFT = 1,
  UFOPAEDIA_TYPE_CRAFT_WEAPON = 2,
  UFOPAEDIA_TYPE_VEHICLE = 3,
  UFOPAEDIA_TYPE_ITEM = 4,
  UFOPAEDIA_TYPE_ARMOR = 5,
  UFOPAEDIA_TYPE_BASE_FACILITY = 6,
  UFOPAEDIA_TYPE_TEXTIMAGE = 7,
  UFOPAEDIA_TYPE_TEXT = 8,
  UFOPAEDIA_TYPE_UFO = 9,
  UFOPAEDIA_TYPE_TFTD = 10,
  UFOPAEDIA_TYPE_TFTD_CRAFT = 11,
  UFOPAEDIA_TYPE_TFTD_CRAFT_WEAPON = 12,
  UFOPAEDIA_TYPE_TFTD_VEHICLE = 13,
  UFOPAEDIA_TYPE_TFTD_ITEM = 14,
  UFOPAEDIA_TYPE_TFTD_ARMOR = 15,
  UFOPAEDIA_TYPE_TFTD_BASE_FACILITY = 16,
  UFOPAEDIA_TYPE_TFTD_USO = 17
}

export type ArticleDefinitionNode = {
  id?: string;
  title?: string;
  section?: string;
  requires?: string[];
  listOrder?: number;
  type_id?: number;
  image_id?: string;
  rect_stats?: Partial<ArticleDefinitionRect>;
  rect_text?: Partial<ArticleDefinitionRect>;
  text?: string;
  text_width?: number;
  weapon?: string;
};

export class ArticleDefinition {
  id = "";
  title = "";
  section = "";
  _requires: string[] = [];
  protected _listOrder = 0;

  constructor(protected _type_id: UfopaediaTypeId) {}

  getType(): UfopaediaTypeId {
    return this._type_id;
  }

  load(node: ArticleDefinitionNode, listOrder: number): void {
    this.id = node.id ?? this.id;
    this.title = this.id;
    this.section = node.section ?? this.section;
    this._requires = node.requires ? [...node.requires] : this._requires;
    this.title = node.title ?? this.title;
    this._listOrder = node.listOrder ?? this._listOrder;
    if (!this._listOrder) {
      this._listOrder = listOrder;
    }
  }

  getListOrder(): number {
    return this._listOrder;
  }
}

export class ArticleDefinitionRect {
  x = 0;
  y = 0;
  width = 0;
  height = 0;

  set(x: number, y: number, width: number, height: number): void {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  load(node?: Partial<ArticleDefinitionRect>): void {
    if (!node) {
      return;
    }
    this.x = node.x ?? this.x;
    this.y = node.y ?? this.y;
    this.width = node.width ?? this.width;
    this.height = node.height ?? this.height;
  }
}

export class ArticleDefinitionCraft extends ArticleDefinition {
  image_id = "";
  rect_stats = new ArticleDefinitionRect();
  rect_text = new ArticleDefinitionRect();
  text = "";

  constructor() {
    super(UfopaediaTypeId.UFOPAEDIA_TYPE_CRAFT);
  }

  override load(node: ArticleDefinitionNode, listOrder: number): void {
    super.load(node, listOrder);
    this.image_id = node.image_id ?? this.image_id;
    this.rect_stats.load(node.rect_stats);
    this.rect_text.load(node.rect_text);
    this.text = node.text ?? this.text;
  }
}

export class ArticleDefinitionCraftWeapon extends ArticleDefinition {
  image_id = "";
  text = "";

  constructor() {
    super(UfopaediaTypeId.UFOPAEDIA_TYPE_CRAFT_WEAPON);
  }

  override load(node: ArticleDefinitionNode, listOrder: number): void {
    super.load(node, listOrder);
    this.image_id = node.image_id ?? this.image_id;
    this.text = node.text ?? this.text;
  }
}

export class ArticleDefinitionText extends ArticleDefinition {
  text = "";

  constructor() {
    super(UfopaediaTypeId.UFOPAEDIA_TYPE_TEXT);
  }

  override load(node: ArticleDefinitionNode, listOrder: number): void {
    super.load(node, listOrder);
    this.text = node.text ?? this.text;
  }
}

export class ArticleDefinitionTextImage extends ArticleDefinition {
  image_id = "";
  text = "";
  text_width = 0;

  constructor() {
    super(UfopaediaTypeId.UFOPAEDIA_TYPE_TEXTIMAGE);
  }

  override load(node: ArticleDefinitionNode, listOrder: number): void {
    super.load(node, listOrder);
    this.image_id = node.image_id ?? this.image_id;
    this.text = node.text ?? this.text;
    this.text_width = node.text_width ?? this.text_width;
  }
}

export class ArticleDefinitionTFTD extends ArticleDefinitionTextImage {
  weapon = "";

  constructor() {
    super();
    this._type_id = UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD;
  }

  override load(node: ArticleDefinitionNode, listOrder: number): void {
    super.load(node, listOrder);
    this._type_id = node.type_id ?? this._type_id;
    this.text_width = node.text_width ?? 157;
    this.weapon = node.weapon ?? this.weapon;
  }
}

export class ArticleDefinitionBaseFacility extends ArticleDefinitionText {
  constructor() {
    super();
    this._type_id = UfopaediaTypeId.UFOPAEDIA_TYPE_BASE_FACILITY;
  }
}

export class ArticleDefinitionItem extends ArticleDefinitionText {
  constructor() {
    super();
    this._type_id = UfopaediaTypeId.UFOPAEDIA_TYPE_ITEM;
  }
}

export class ArticleDefinitionUfo extends ArticleDefinitionText {
  constructor() {
    super();
    this._type_id = UfopaediaTypeId.UFOPAEDIA_TYPE_UFO;
  }
}

export class ArticleDefinitionArmor extends ArticleDefinitionText {
  constructor() {
    super();
    this._type_id = UfopaediaTypeId.UFOPAEDIA_TYPE_ARMOR;
  }
}

export class ArticleDefinitionVehicle extends ArticleDefinitionText {
  weapon = "";

  constructor() {
    super();
    this._type_id = UfopaediaTypeId.UFOPAEDIA_TYPE_VEHICLE;
  }

  override load(node: ArticleDefinitionNode, listOrder: number): void {
    super.load(node, listOrder);
    this.weapon = node.weapon ?? this.weapon;
  }
}
