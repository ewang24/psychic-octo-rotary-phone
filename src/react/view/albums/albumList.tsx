import React, { ReactElement, useEffect, useState } from 'react';
import ViewContainer from '../global/viewContainer';
import '../../styles/albums/albumsList.scss'
import '../../assets/img/test.jpg'
import '../../assets/img/up.jpg'
import SongsForAlbum from './songsForAlbum';
import OverlayView from '../global/overlayView';
import { Album } from '../../../core/db/dbEntities/album';
import { AlbumService } from './electronServices/albumService';

const AlbumList = () => {

  const [albums, setAlbums] = useState<Album[] | undefined>();
  const [selectedAlbum, setSelectedAlbum] = useState<Album | undefined>();

  useEffect(() => {
    AlbumService.getAlbums()
      .then((albums: Album[]) => {
        console.log(albums[0])
        setAlbums(albums);
      });
  }, []);

  function renderAlbumList(): ReactElement {
    return <div className='albums-wrap-container'>
      {albums.map((album: Album, index) => {
        return <div key={index} className='p-tile' onClick={() => setSelectedAlbum(album)}>
          <div className='p-tile-image'>
            {album.coverImageBase64 &&
              <img src={`data:image/jpg;base64,${album.coverImageBase64}`}></img>
            }
            {!album.coverImageBase64 &&
              <>
                {index % 2 === 0 &&
                  <img draggable="false"
                    src='../../assets/img/test.jpg'
                  />
                }
                {index % 2 !== 0 &&
                  <img draggable="false"
                    src='../../assets/img/up.jpg'
                  />
                }
              </>
            }
          </div>
          <span className='album-name'>{album.name}</span>
          <span className='artist-name'>{`${album.artistName}`}</span>
        </div>
      })}
    </div>
  }

  function closeSongsForAlbumView() {
    setSelectedAlbum(undefined);
  }

  return (
    <>
      {/* This is the album list */}
      <ViewContainer>
        <h1 className='album-list-title'>Your Albums</h1>
        {albums && albums.length > 0 &&
          renderAlbumList()
        }
      </ViewContainer>
      {
        selectedAlbum && <OverlayView>
          <SongsForAlbum album={selectedAlbum} closeSongsForAlbumView={closeSongsForAlbumView} />
        </OverlayView>
      }
    </>
  );
};

export default AlbumList;
