export interface IUpdateProfileRequest {
  nomeCompleto?: string;
  username?: string;
  email?: string;
}

export interface IUpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Interface atualizada para corresponder à entidade 'Projeto'
export interface ICreateUpdateProjetoRequest {
  ods?: string;
  prefeitura?: string;
  nomeProjeto?: string;
  emailContato?: string;
  endereco?: string;
  descricao?: string;
  descricaoDiferencial?: string;
  odsRelacionadas?: string;
  website?: string;
  instagram?: string;
  ativo?: boolean;
  logoUrl?: string;
}