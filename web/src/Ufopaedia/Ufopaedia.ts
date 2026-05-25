import type { Game } from "../Engine/Game.ts";
import type { SavedGame } from "../Savegame/SavedGame.ts";
import type { Mod } from "../Mod/Mod.ts";
import { ArticleDefinition, UfopaediaTypeId } from "../Mod/ArticleDefinition.ts";
import type {
  ArticleDefinitionArmor,
  ArticleDefinitionBaseFacility,
  ArticleDefinitionCraft,
  ArticleDefinitionCraftWeapon,
  ArticleDefinitionItem,
  ArticleDefinitionText,
  ArticleDefinitionTextImage,
  ArticleDefinitionTFTD,
  ArticleDefinitionUfo,
  ArticleDefinitionVehicle
} from "../Mod/ArticleDefinition.ts";
import type { ArticleState } from "./ArticleState.ts";
import { ArticleStateArmor } from "./ArticleStateArmor.ts";
import { ArticleStateBaseFacility } from "./ArticleStateBaseFacility.ts";
import { ArticleStateCraft } from "./ArticleStateCraft.ts";
import { ArticleStateCraftWeapon } from "./ArticleStateCraftWeapon.ts";
import { ArticleStateItem } from "./ArticleStateItem.ts";
import { ArticleStateText } from "./ArticleStateText.ts";
import { ArticleStateTextImage } from "./ArticleStateTextImage.ts";
import { ArticleStateUfo } from "./ArticleStateUfo.ts";
import { ArticleStateVehicle } from "./ArticleStateVehicle.ts";
import { ArticleStateTFTD } from "./ArticleStateTFTD.ts";
import { ArticleStateTFTDArmor } from "./ArticleStateTFTDArmor.ts";
import { ArticleStateTFTDCraft } from "./ArticleStateTFTDCraft.ts";
import { ArticleStateTFTDCraftWeapon } from "./ArticleStateTFTDCraftWeapon.ts";
import { ArticleStateTFTDFacility } from "./ArticleStateTFTDFacility.ts";
import { ArticleStateTFTDItem } from "./ArticleStateTFTDItem.ts";
import { ArticleStateTFTDUso } from "./ArticleStateTFTDUso.ts";
import { ArticleStateTFTDVehicle } from "./ArticleStateTFTDVehicle.ts";
import { UfopaediaStartState } from "./UfopaediaStartState.ts";

export type ArticleDefinitionList = ArticleDefinition[];

export const UFOPAEDIA_NOT_AVAILABLE = "STR_NOT_AVAILABLE";

/**
 * Ufopaedia helpers for article availability and navigation.
 */
export class Ufopaedia {
  private static _current_index = 0;

  static isArticleAvailable(save: SavedGame | null, article: ArticleDefinition | null): boolean {
    if (!save || !article) {
      return false;
    }
    return save.isResearched(article._requires);
  }

  static openArticle(game: Game, articleId: string): void;
  static openArticle(game: Game, article: ArticleDefinition): void;
  static openArticle(game: Game, articleOrId: string | ArticleDefinition): void {
    if (typeof articleOrId === "string") {
      const idRef = { value: articleOrId };
      const index = this.getArticleIndex(game.getSavedGame(), game.getMod(), idRef);
      this._current_index = index;
      if (index !== -1) {
        const article = game.getMod()?.getUfopaediaArticle(idRef.value) || null;
        if (article) {
          game.pushState(this.createArticleState(article));
        }
      }
      return;
    }

    const idRef = { value: articleOrId.id };
    const index = this.getArticleIndex(game.getSavedGame(), game.getMod(), idRef);
    this._current_index = index;
    if (index !== -1) {
      game.pushState(this.createArticleState(articleOrId));
    }
  }

  static open(game: Game): void {
    game.pushState(new UfopaediaStartState());
  }

  static next(game: Game): void {
    const articles = this.getAvailableArticles(game.getSavedGame(), game.getMod());
    if (articles.length === 0) {
      return;
    }
    if (this._current_index >= articles.length - 1) {
      this._current_index = 0;
    } else {
      this._current_index++;
    }
    game.popState();
    const article = articles[this._current_index];
    if (article) {
      game.pushState(this.createArticleState(article));
    }
  }

  static prev(game: Game): void {
    const articles = this.getAvailableArticles(game.getSavedGame(), game.getMod());
    if (articles.length === 0) {
      return;
    }
    if (this._current_index === 0) {
      this._current_index = articles.length - 1;
    } else {
      this._current_index--;
    }
    game.popState();
    const article = articles[this._current_index];
    if (article) {
      game.pushState(this.createArticleState(article));
    }
  }

  static list(save: SavedGame | null, mod: Mod | null, section: string, data: ArticleDefinitionList): void {
    const articles = this.getAvailableArticles(save, mod);
    for (const article of articles) {
      if (article.section === section) {
        data.push(article);
      }
    }
  }

  private static getArticleIndex(save: SavedGame | null, mod: Mod | null, articleId: { value: string }): number {
    if (!save || !mod) {
      return -1;
    }
    const ucId = `${articleId.value}_UC`;
    const articles = this.getAvailableArticles(save, mod);
    for (let i = 0; i < articles.length; ++i) {
      if (articles[i].id === articleId.value) {
        return i;
      }
    }
    for (let i = 0; i < articles.length; ++i) {
      if (articles[i].id === ucId) {
        articleId.value = ucId;
        return i;
      }
    }
    for (let i = 0; i < articles.length; ++i) {
      for (const requirement of articles[i]._requires) {
        if (articleId.value === requirement) {
          articleId.value = articles[i].id;
          return i;
        }
      }
    }
    return -1;
  }

  private static getAvailableArticles(save: SavedGame | null, mod: Mod | null): ArticleDefinitionList {
    if (!save || !mod) {
      return [];
    }
    const articles: ArticleDefinition[] = [];
    for (const id of mod.getUfopaediaList()) {
      const article = mod.getUfopaediaArticle(id);
      if (article && this.isArticleAvailable(save, article) && article.section !== UFOPAEDIA_NOT_AVAILABLE) {
        articles.push(article);
      }
    }
    return articles;
  }

  private static createArticleState(article: ArticleDefinition): ArticleState {
    switch (article.getType()) {
      case UfopaediaTypeId.UFOPAEDIA_TYPE_CRAFT:
        return new ArticleStateCraft(article as ArticleDefinitionCraft);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_CRAFT_WEAPON:
        return new ArticleStateCraftWeapon(article as ArticleDefinitionCraftWeapon);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_VEHICLE:
        return new ArticleStateVehicle(article as ArticleDefinitionVehicle);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_ITEM:
        return new ArticleStateItem(article as ArticleDefinitionItem);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_ARMOR:
        return new ArticleStateArmor(article as ArticleDefinitionArmor);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_BASE_FACILITY:
        return new ArticleStateBaseFacility(article as ArticleDefinitionBaseFacility);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TEXT:
        return new ArticleStateText(article as ArticleDefinitionText);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TEXTIMAGE:
        return new ArticleStateTextImage(article as ArticleDefinitionTextImage);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_UFO:
        return new ArticleStateUfo(article as ArticleDefinitionUfo);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD:
        return new ArticleStateTFTD(article as ArticleDefinitionTFTD);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD_CRAFT:
        return new ArticleStateTFTDCraft(article as ArticleDefinitionTFTD);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD_CRAFT_WEAPON:
        return new ArticleStateTFTDCraftWeapon(article as ArticleDefinitionTFTD);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD_VEHICLE:
        return new ArticleStateTFTDVehicle(article as ArticleDefinitionTFTD);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD_ITEM:
        return new ArticleStateTFTDItem(article as ArticleDefinitionTFTD);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD_ARMOR:
        return new ArticleStateTFTDArmor(article as ArticleDefinitionTFTD);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD_BASE_FACILITY:
        return new ArticleStateTFTDFacility(article as ArticleDefinitionTFTD);
      case UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD_USO:
        return new ArticleStateTFTDUso(article as ArticleDefinitionTFTD);
      default:
        throw new Error(`Unsupported Ufopaedia article type ${article.getType()}.`);
    }
  }
}
