import React from 'react';

const EmptyState = ({ icon, titulo, descricao, botaoTexto, onBotao, classes }) => {
  const defaultClasses = {
    container: 'empty-state',
    icon: 'empty-state-icon',
    titulo: 'empty-state-titulo',
    descricao: 'empty-state-descricao',
    botao: 'empty-state-botao',
    ...classes,
  };

  return (
    <div className={defaultClasses.container}>
      {icon && <div className={defaultClasses.icon}>{icon}</div>}
      <h3 className={defaultClasses.titulo}>{titulo}</h3>
      <p className={defaultClasses.descricao}>{descricao}</p>
      {botaoTexta && onBotao && (
        <button className={defaultClasses.botao} onClick={onBotao}>
          {botaoTexto}
        </button>
      )}
    </div>
  );
};

EmptyState.defaultProps = {
  icon: null,
  titulo: '',
  descricao: '',
  botaoTexto: '',
  onBotao: () => {},
  classes: {},
};

export default EmptyState;