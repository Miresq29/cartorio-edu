// A plataforma nasceu para cartórios, mas hoje atende qualquer tipo de empresa. O tipo
// de organização é definido na ativação do cliente (TenantsView) e fica salvo no próprio
// documento do tenant — tenants antigos sem o campo continuam como "cartorio" (padrão).
export type TipoOrganizacao = 'cartorio' | 'empresa';

interface Formas {
  singular: string;
  plural: string;
  artigoSingular: string;
  artigoPlural: string;
  doArtigo: string;
  dosArtigo: string;
  seu: string;
}

const FORMAS: Record<TipoOrganizacao, Formas> = {
  cartorio: {
    singular: 'cartório', plural: 'cartórios',
    artigoSingular: 'o cartório', artigoPlural: 'os cartórios',
    doArtigo: 'do cartório', dosArtigo: 'dos cartórios',
    seu: 'seu cartório',
  },
  empresa: {
    singular: 'empresa', plural: 'empresas',
    artigoSingular: 'a empresa', artigoPlural: 'as empresas',
    doArtigo: 'da empresa', dosArtigo: 'das empresas',
    seu: 'sua empresa',
  },
};

export function termos(tipo?: TipoOrganizacao | null): Formas {
  return FORMAS[tipo === 'empresa' ? 'empresa' : 'cartorio'];
}
