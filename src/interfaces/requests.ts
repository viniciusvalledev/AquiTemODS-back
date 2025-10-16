export interface IUpdateProfileRequest {
  nomeCompleto?: string;
  username?: string;
  email?: string;
}

export interface IUpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ICreateUpdateProjetoRequest {
  ods?: string;
  prefeitura?: string;
  secretaria?: string;
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