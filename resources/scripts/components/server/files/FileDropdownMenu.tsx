import React, { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCopy,
    faEllipsisH,
    faFileArchive,
    faFileDownload,
    faLevelUpAlt,
    faPencilAlt,
    faTrashAlt,
    IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import RenameFileModal from '@/components/server/files/RenameFileModal';
import { ServerContext } from '@/state/server';
import { join } from 'path';
import deleteFiles from '@/api/server/files/deleteFiles';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import copyFile from '@/api/server/files/copyFile';
import Can from '@/components/elements/Can';
import getFileDownloadUrl from '@/api/server/files/getFileDownloadUrl';
import useServer from '@/plugins/useServer';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import { FileObject } from '@/api/server/files/loadDirectory';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import DropdownMenu from '@/components/elements/DropdownMenu';
import styled from 'styled-components/macro';
import useEventListener from '@/plugins/useEventListener';
import compressFiles from '@/api/server/files/compressFiles';

type ModalType = 'rename' | 'move';

const StyledRow = styled.div<{ $danger?: boolean }>`
    ${tw`p-2 flex items-center rounded`};
    ${props => props.$danger ? tw`hover:bg-red-100 hover:text-red-700` : tw`hover:bg-neutral-100 hover:text-neutral-700`};
`;

interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
    icon: IconDefinition;
    title: string;
    $danger?: boolean;
}

const Row = ({ icon, title, ...props }: RowProps) => (
    <StyledRow {...props}>
        <FontAwesomeIcon icon={icon} css={tw`text-xs`}/>
        <span css={tw`ml-2`}>{title}</span>
    </StyledRow>
);

export default ({ file }: { file: FileObject }) => {
    const onClickRef = useRef<DropdownMenu>(null);
    const [ showSpinner, setShowSpinner ] = useState(false);
    const [ modal, setModal ] = useState<ModalType | null>(null);

    const { uuid } = useServer();
    const { mutate } = useFileManagerSwr();
    const { clearAndAddHttpError, clearFlashes } = useFlash();
    const directory = ServerContext.useStoreState(state => state.files.directory);

    useEventListener(`pterodactyl:files:ctx:${file.uuid}`, (e: CustomEvent) => {
        if (onClickRef.current) {
            onClickRef.current.triggerMenu(e.detail);
        }
    });

    const doDeletion = () => {
        clearFlashes('files');

        // For UI speed, immediately remove the file from the listing before calling the deletion function.
        // If the delete actually fails, we'll fetch the current directory contents again automatically.
        mutate(files => files.filter(f => f.uuid !== file.uuid), false);

        deleteFiles(uuid, directory, [ file.name ]).catch(error => {
            mutate();
            clearAndAddHttpError({ key: 'files', error });
        });
    };

    const doCopy = () => {
        setShowSpinner(true);
        clearFlashes('files');

        copyFile(uuid, join(directory, file.name))
            .then(() => mutate())
            .catch(error => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    const doDownload = () => {
        setShowSpinner(true);
        clearFlashes('files');

        getFileDownloadUrl(uuid, join(directory, file.name))
            .then(url => {
                // @ts-ignore
                window.location = url;
            })
            .catch(error => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    const doArchive = () => {
        setShowSpinner(true);
        clearFlashes('files');

        compressFiles(uuid, directory, [ file.name ])
            .then(() => mutate())
            .catch(error => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    return (
        <DropdownMenu
            ref={onClickRef}
            renderToggle={onClick => (
                <div css={tw`p-3 hover:text-white`} onClick={onClick}>
                    <FontAwesomeIcon icon={faEllipsisH}/>
                    {!!modal &&
                    <RenameFileModal
                        visible
                        appear
                        files={[ file.name ]}
                        useMoveTerminology={modal === 'move'}
                        onDismissed={() => setModal(null)}
                    />
                    }
                    <SpinnerOverlay visible={showSpinner} fixed size={'large'}/>
                </div>
            )}
        >
            <Can action={'file.update'}>
                <Row onClick={() => setModal('rename')} icon={faPencilAlt} title={'Rename'}/>
                <Row onClick={() => setModal('move')} icon={faLevelUpAlt} title={'Move'}/>
            </Can>
            {file.isFile &&
            <Can action={'file.create'}>
                <Row onClick={doCopy} icon={faCopy} title={'Copy'}/>
            </Can>
            }
            <Can action={'file.archive'}>
                <Row onClick={doArchive} icon={faFileArchive} title={'Archive'}/>
            </Can>
            <Row onClick={doDownload} icon={faFileDownload} title={'Download'}/>
            <Can action={'file.delete'}>
                <Row onClick={doDeletion} icon={faTrashAlt} title={'Delete'} $danger/>
            </Can>
        </DropdownMenu>
    );
};
